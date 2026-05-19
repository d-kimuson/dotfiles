import { createHash } from "node:crypto";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const MASK_TEMPLATE_PREFIX = "**secret-will-be-restored-keep-as-is-";
const MASK_TEMPLATE_SUFFIX = "**";
const MASK_PATTERN = /\*\*secret-will-be-restored-keep-as-is-[a-zA-Z0-9_-]{10}\*\*/;
const MAX_TRAVERSE_DEPTH = 32;
const OPAQUE_PROVIDER_FIELD_KEYS = new Set([
	"data",
	"encrypted_content",
	"encryptedContent",
	"id",
	"prompt_cache_key",
	"responseId",
	"session_id",
	"signature",
	"textSignature",
	"thinkingSignature",
	"thoughtSignature",
	"x-client-request-id",
]);

/**
 * Conservative, gitleaks-style detectors for common secrets.
 * Keep the patterns specific enough to avoid masking ordinary prose.
 */
const SECRET_PATTERNS: RegExp[] = [
	// OpenAI / OpenAI-compatible examples, e.g. sk-fj**secret-will-be-restored-keep-as-is-XzUuJ0dZ_w**dj
	/\bsk-[A-Za-z0-9_-]{20,}\b/g,
	// Anthropic
	/\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
	// GitHub classic and fine-grained tokens
	/\bgh[pousr]_[A-Za-z0-9_]{36,255}\b/g,
	/\bgithub_pat_[A-Za-z0-9_]{20,255}\b/g,
	// AWS access key IDs
	/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
	// Google API keys
	/\bAIza[0-9A-Za-z_-]{35}\b/g,
	// Slack tokens
	/\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g,
	// Stripe live/test secret keys
	/\b(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{20,}\b/g,
	// JWT-like bearer tokens. Requires three sizeable base64url segments.
	/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
];

type PlainObject = Record<string, unknown>;

type SecretMapping = {
	readonly secret: string;
	readonly masked: string;
};

const isPlainObject = (value: unknown): value is PlainObject => {
	return typeof value === "object" && value !== null && !Array.isArray(value);
};

const miniHash = (value: string): string => {
	return createHash("sha256").update(value).digest("base64url").slice(0, 10);
};

const visibleEdgeLength = (secret: string): number => {
	return secret.length <= 12 ? 2 : 5;
};

const makeMask = (secret: string): string => {
	const edgeLength = visibleEdgeLength(secret);
	const head = secret.slice(0, edgeLength);
	const tail = secret.slice(-Math.min(2, Math.max(0, secret.length - edgeLength)));
	return `${head}${MASK_TEMPLATE_PREFIX}${miniHash(secret)}${MASK_TEMPLATE_SUFFIX}${tail}`;
};

const collectSecretMatches = (text: string): string[] => {
	const matches: string[] = [];
	for (const pattern of SECRET_PATTERNS) {
		pattern.lastIndex = 0;
		for (const match of text.matchAll(pattern)) {
			const secret = match[0];
			if (MASK_PATTERN.test(secret)) continue;
			matches.push(secret);
		}
	}
	return [...new Set(matches)].sort((a, b) => b.length - a.length);
};

const replaceAllLiteral = (text: string, search: string, replacement: string): string => {
	return text.split(search).join(replacement);
};

export const __secretMaskingInternals = {
	MASK_TEMPLATE_PREFIX,
	MASK_TEMPLATE_SUFFIX,
	SECRET_PATTERNS,
	collectSecretMatches,
	makeMask,
};

export default function secretMaskExtension(pi: ExtensionAPI) {
	const secretToMapping = new Map<string, SecretMapping>();
	const maskToSecret = new Map<string, string>();

	const rememberSecret = (secret: string): SecretMapping => {
		const existing = secretToMapping.get(secret);
		if (existing) return existing;

		const mapping = { secret, masked: makeMask(secret) };
		secretToMapping.set(secret, mapping);
		maskToSecret.set(mapping.masked, secret);
		return mapping;
	};

	const maskSecretsInString = (value: string): string => {
		let masked = value;
		for (const secret of collectSecretMatches(value)) {
			const mapping = rememberSecret(secret);
			masked = replaceAllLiteral(masked, secret, mapping.masked);
		}
		return masked;
	};

	const unmaskSecretsInString = (value: string): string => {
		let unmasked = value;
		for (const [masked, secret] of maskToSecret) {
			unmasked = replaceAllLiteral(unmasked, masked, secret);
		}
		return unmasked;
	};

	const transformDeep = (
		value: unknown,
		transformString: (value: string) => string,
		depth = 0,
		key: string | undefined = undefined,
		skipKeys: ReadonlySet<string> | undefined = undefined,
	): unknown => {
		if (depth > MAX_TRAVERSE_DEPTH) return value;
		if (typeof value === "string") {
			return key && skipKeys?.has(key) ? value : transformString(value);
		}
		if (Array.isArray(value)) return value.map((item) => transformDeep(item, transformString, depth + 1, key, skipKeys));
		if (!isPlainObject(value)) return value;

		const transformed: PlainObject = {};
		for (const [nestedKey, nestedValue] of Object.entries(value)) {
			transformed[nestedKey] = transformDeep(nestedValue, transformString, depth + 1, nestedKey, skipKeys);
		}
		return transformed;
	};

	const transformDeepInPlace = (value: unknown, transformString: (value: string) => string, depth = 0): unknown => {
		if (depth > MAX_TRAVERSE_DEPTH) return value;
		if (typeof value === "string") return transformString(value);
		if (Array.isArray(value)) {
			for (let index = 0; index < value.length; index += 1) {
				value[index] = transformDeepInPlace(value[index], transformString, depth + 1);
			}
			return value;
		}
		if (!isPlainObject(value)) return value;

		for (const [key, nestedValue] of Object.entries(value)) {
			value[key] = transformDeepInPlace(nestedValue, transformString, depth + 1);
		}
		return value;
	};

	pi.on("before_provider_request", (event) => {
		return transformDeep(event.payload, maskSecretsInString, 0, undefined, OPAQUE_PROVIDER_FIELD_KEYS);
	});

	pi.on("message_update", (event) => {
		// Streaming events can split placeholders across deltas. Mutating the cumulative
		// partial message each update lets us restore once the full placeholder appears.
		transformDeepInPlace(event.message, unmaskSecretsInString);
		transformDeepInPlace(event.assistantMessageEvent, unmaskSecretsInString);
	});

	pi.on("message_end", (event) => {
		return { message: transformDeep(event.message, unmaskSecretsInString) as typeof event.message };
	});

	pi.on("tool_call", (event) => {
		// Tool arguments are generated by the model and may contain masks. Restore them
		// immediately before execution so tools read/write the real secret value.
		transformDeepInPlace(event.input, unmaskSecretsInString);
	});

	pi.on("tool_result", (event) => {
		// Tool results go to both the UI/session and future model context. Store/display
		// the real value for the client; before_provider_request masks it again before
		// any provider call.
		return {
			content: transformDeep(event.content, unmaskSecretsInString) as typeof event.content,
			details: transformDeep(event.details, unmaskSecretsInString),
		};
	});
}
