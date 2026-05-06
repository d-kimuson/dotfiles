import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

type ModelSpec = {
	readonly provider: string;
	readonly model: string;
	readonly thinkingLevel: ThinkingLevel | undefined;
	readonly raw: string;
};

type PrimaryModel = {
	readonly provider: string;
	readonly model: string;
	readonly thinkingLevel: ThinkingLevel;
};

const FALLBACK_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

const parseThinkingLevel = (value: string): ThinkingLevel | undefined => {
	switch (value) {
		case "off":
		case "minimal":
		case "low":
		case "medium":
		case "high":
		case "xhigh":
			return value;
		default:
			return undefined;
	}
};

const parseModelSpec = (rawSpec: string): ModelSpec | undefined => {
	const raw = rawSpec.trim();
	if (!raw) return undefined;

	const slashIndex = raw.indexOf("/");
	if (slashIndex <= 0 || slashIndex === raw.length - 1) return undefined;

	const colonIndex = raw.lastIndexOf(":");
	const hasThinkingSuffix = colonIndex > slashIndex;
	const modelPart = hasThinkingSuffix ? raw.slice(0, colonIndex) : raw;
	const thinkingPart = hasThinkingSuffix ? raw.slice(colonIndex + 1) : undefined;
	const providerSeparator = modelPart.indexOf("/");
	const provider = modelPart.slice(0, providerSeparator).trim();
	const model = modelPart.slice(providerSeparator + 1).trim();

	if (!provider || !model) return undefined;

	if (!thinkingPart) {
		return { provider, model, thinkingLevel: undefined, raw };
	}

	const thinkingLevel = parseThinkingLevel(thinkingPart.trim());
	if (!thinkingLevel) return undefined;

	return { provider, model, thinkingLevel, raw };
};

const parseFallbackModels = (value: boolean | string | undefined): ModelSpec[] => {
	if (typeof value !== "string") return [];
	return value
		.split(",")
		.map(parseModelSpec)
		.filter((spec) => spec !== undefined);
};

const modelKey = (provider: string, model: string): string => `${provider}/${model}`;

const isFallbackableError = (status: number | undefined, errorMessage: string | undefined): boolean => {
	if (status !== undefined && FALLBACK_STATUSES.has(status)) return true;
	if (!errorMessage) return true;

	const lower = errorMessage.toLowerCase();
	if (lower.includes("context") && (lower.includes("length") || lower.includes("window") || lower.includes("too long"))) {
		return false;
	}

	return (
		lower.includes("rate") ||
		lower.includes("quota") ||
		lower.includes("limit") ||
		lower.includes("overload") ||
		lower.includes("unavailable") ||
		lower.includes("timeout") ||
		lower.includes("429") ||
		lower.includes("500") ||
		lower.includes("502") ||
		lower.includes("503") ||
		lower.includes("504") ||
		lower.includes("529")
	);
};

const fitsCurrentContext = (ctx: ExtensionContext, spec: ModelSpec): boolean => {
	const model = ctx.modelRegistry.find(spec.provider, spec.model);
	if (!model) return false;

	const usage = ctx.getContextUsage();
	if (!usage) return true;

	// Leave room for the fallback model's own response and provider overhead.
	return usage.tokens < Math.floor(model.contextWindow * 0.9);
};

export default function modelFallbackExtension(pi: ExtensionAPI) {
	let fallbackModels: ModelSpec[] = [];
	let primaryModel: PrimaryModel | undefined;
	let currentFallbackIndex = -1;
	let applyingModelChange = false;
	let lastFallbackableStatus: number | undefined;
	let handledErrorTimestamps = new Set<number>();

	pi.registerFlag("fallback-models", {
		description: "Comma-separated fallback models as provider/model[:thinking], tried in order after provider failures",
		type: "string",
	});

	const updateStatus = (ctx: ExtensionContext): void => {
		if (fallbackModels.length === 0) {
			ctx.ui.setStatus("fallback", undefined);
			return;
		}

		const position = currentFallbackIndex < 0 ? "primary" : `${currentFallbackIndex + 1}/${fallbackModels.length}`;
		ctx.ui.setStatus("fallback", `fallback:${position}`);
	};

	const switchToSpec = async (spec: ModelSpec, index: number, ctx: ExtensionContext): Promise<boolean> => {
		const model = ctx.modelRegistry.find(spec.provider, spec.model);
		if (!model) {
			ctx.ui.notify(`Fallback model not found: ${spec.raw}`, "warning");
			return false;
		}

		if (!fitsCurrentContext(ctx, spec)) {
			ctx.ui.notify(`Fallback model skipped because context is too large: ${spec.raw}`, "warning");
			return false;
		}

		applyingModelChange = true;
		const success = await pi.setModel(model);
		applyingModelChange = false;

		if (!success) {
			ctx.ui.notify(`Fallback model has no configured auth: ${spec.raw}`, "warning");
			return false;
		}

		if (spec.thinkingLevel) {
			pi.setThinkingLevel(spec.thinkingLevel);
		}

		currentFallbackIndex = index;
		updateStatus(ctx);
		ctx.ui.notify(`Switched to fallback model: ${spec.raw}`, "warning");
		return true;
	};

	const switchToNextFallback = async (ctx: ExtensionContext): Promise<ModelSpec | undefined> => {
		for (let index = currentFallbackIndex + 1; index < fallbackModels.length; index += 1) {
			const spec = fallbackModels[index];
			if (!spec) continue;
			const switched = await switchToSpec(spec, index, ctx);
			if (switched) return spec;
		}
		return undefined;
	};

	const resetToPrimary = async (ctx: ExtensionContext): Promise<void> => {
		if (!primaryModel) {
			ctx.ui.notify("No primary model recorded for fallback reset", "warning");
			return;
		}

		const model = ctx.modelRegistry.find(primaryModel.provider, primaryModel.model);
		if (!model) {
			ctx.ui.notify(`Primary model not found: ${modelKey(primaryModel.provider, primaryModel.model)}`, "error");
			return;
		}

		applyingModelChange = true;
		const success = await pi.setModel(model);
		applyingModelChange = false;
		if (!success) {
			ctx.ui.notify(`Primary model has no configured auth: ${modelKey(primaryModel.provider, primaryModel.model)}`, "error");
			return;
		}

		pi.setThinkingLevel(primaryModel.thinkingLevel);
		currentFallbackIndex = -1;
		updateStatus(ctx);
		ctx.ui.notify(`Reset to primary model: ${modelKey(primaryModel.provider, primaryModel.model)}`, "info");
	};

	const describeStatus = (ctx: ExtensionContext): string => {
		const current = ctx.model ? modelKey(ctx.model.provider, ctx.model.id) : "none";
		const primary = primaryModel ? `${modelKey(primaryModel.provider, primaryModel.model)}:${primaryModel.thinkingLevel}` : "none";
		const fallbackList = fallbackModels.length > 0 ? fallbackModels.map((spec) => spec.raw).join(", ") : "none";
		const position = currentFallbackIndex < 0 ? "primary" : `fallback ${currentFallbackIndex + 1}/${fallbackModels.length}`;
		return `Model fallback\ncurrent: ${current}\nposition: ${position}\nprimary: ${primary}\nfallbacks: ${fallbackList}`;
	};

	pi.registerCommand("fallback", {
		description: "Show or control model fallback state: /fallback [status|next|reset]",
		handler: async (args, ctx) => {
			const command = args.trim();
			if (!command || command === "status") {
				ctx.ui.notify(describeStatus(ctx), "info");
				return;
			}

			if (command === "next") {
				const spec = await switchToNextFallback(ctx);
				if (!spec) ctx.ui.notify("No more fallback models available", "warning");
				return;
			}

			if (command === "reset") {
				await resetToPrimary(ctx);
				return;
			}

			ctx.ui.notify("Usage: /fallback [status|next|reset]", "error");
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		fallbackModels = parseFallbackModels(pi.getFlag("fallback-models"));
		currentFallbackIndex = -1;
		lastFallbackableStatus = undefined;
		handledErrorTimestamps = new Set<number>();
		primaryModel = ctx.model
			? { provider: ctx.model.provider, model: ctx.model.id, thinkingLevel: pi.getThinkingLevel() }
			: undefined;

		if (fallbackModels.length > 0) {
			const available = fallbackModels.map((spec) => spec.raw).join(", ");
			ctx.ui.notify(`Model fallback enabled: ${available}`, "info");
		}
		updateStatus(ctx);
	});

	pi.on("model_select", async (event, ctx) => {
		if (applyingModelChange) return;

		const selectedKey = modelKey(event.model.provider, event.model.id);
		const fallbackIndex = fallbackModels.findIndex((spec) => modelKey(spec.provider, spec.model) === selectedKey);
		currentFallbackIndex = fallbackIndex;
		if (fallbackIndex < 0) {
			primaryModel = { provider: event.model.provider, model: event.model.id, thinkingLevel: pi.getThinkingLevel() };
		}
		updateStatus(ctx);
	});

	pi.on("after_provider_response", async (event) => {
		lastFallbackableStatus = FALLBACK_STATUSES.has(event.status) ? event.status : undefined;
	});

	pi.on("message_end", async (event, ctx) => {
		if (fallbackModels.length === 0) return;
		if (event.message.role !== "assistant") return;
		if (event.message.stopReason !== "error") return;
		if (handledErrorTimestamps.has(event.message.timestamp)) return;
		handledErrorTimestamps.add(event.message.timestamp);

		const shouldFallback = isFallbackableError(lastFallbackableStatus, event.message.errorMessage);
		const status = lastFallbackableStatus;
		lastFallbackableStatus = undefined;

		if (!shouldFallback) {
			ctx.ui.notify(`Model fallback skipped for non-provider error: ${event.message.errorMessage ?? "unknown error"}`, "warning");
			return;
		}

		const nextSpec = await switchToNextFallback(ctx);
		if (!nextSpec) {
			ctx.ui.notify("Model fallback exhausted", "error");
			return;
		}

		const reason = status ? `HTTP ${status}` : (event.message.errorMessage ?? "provider error");
		pi.sendUserMessage(
			`The previous model request failed (${reason}). Continue the user's last request from the current conversation state using the newly selected fallback model (${nextSpec.raw}). Do not repeat completed tool side effects unless necessary.`,
			{ deliverAs: "followUp" },
		);
	});
}
