/**
 * Usage Status Extension
 *
 * Shows subscription quota in the footer status line via ctx.ui.setStatus():
 *   - OpenCode Go  : rolling / weekly / monthly usage percent (undocumented API)
 *   - Codex        : ChatGPT subscription (wham) usage percent (undocumented API)
 *
 * Data sources:
 *   - OpenCode Go: GET https://opencode.ai/zen/go/v1/usage
 *     Bearer key from ~/.pi/agent/auth.json (opencode-go), then
 *     ~/.local/share/opencode/auth.json (opencode-go), then OPENCODE_API_KEY.
 *     Response: { usage: { rolling, weekly, monthly: { status, percent, resetsAt } } }
 *   - Codex: GET https://chatgpt.com/backend-api/wham/usage
 *     Bearer access_token from ~/.codex/auth.json (+ ChatGPT-Account-Id).
 *     On 401/403 the token is refreshed via auth.openai.com/oauth/token and
 *     saved back. Response: { plan_type, rate_limit: { primary_window } }.
 *
 * Both endpoints are undocumented and may change without notice.
 * A browser-like User-Agent is required (Cloudflare / WAF).
 */

import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "usage";
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const BROWSER_USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// --- OpenCode Go ---
const OPENCODE_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";

// --- Codex / ChatGPT subscription ---
const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token";
const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";

// --- Types ---

type UsageWindow = { status: string; percent: number; resetsAt: string | null };

type OpenCodeGoUsage = {
	rolling: UsageWindow;
	weekly: UsageWindow;
	monthly: UsageWindow;
};

type CodexRateWindow = { used_percent?: number; reset_at?: number } | null | undefined;

type CodexUsage = {
	plan_type?: string | null;
	rate_limit?: { primary_window?: CodexRateWindow; secondary_window?: CodexRateWindow } | null;
	credits?: { has_credits?: boolean; balance?: number | string | null } | null;
};

type CodexAuthRecord = {
	path: string;
	accessToken: string;
	refreshToken?: string;
	accountId?: string;
};

type FetchedUsage = {
	go: OpenCodeGoUsage | null;
	codex: CodexUsage | null;
	goError: string | null;
	codexError: string | null;
};

// --- Key / auth resolution ---

async function readJson(path: string): Promise<Record<string, unknown> | null> {
	try {
		return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function extractKey(entry: unknown): string | null {
	if (!entry || typeof entry !== "object") return null;
	const value = entry as Record<string, unknown>;
	const key = value.key ?? value.access;
	return typeof key === "string" && key.length > 8 ? key : null;
}

/**
 * OpenCode Go API key, resolved from the same places pi / opencode store it.
 */
async function resolveOpenCodeGoKey(): Promise<string | null> {
	if (process.env.OPENCODE_API_KEY) return process.env.OPENCODE_API_KEY;
	const candidates = [
		join(homedir(), ".pi", "agent", "auth.json"), // pi's own auth store
		join(homedir(), ".local", "share", "opencode", "auth.json"), // opencode CLI
	];
	for (const path of candidates) {
		const data = await readJson(path);
		if (!data) continue;
		const key = extractKey(data["opencode-go"]) ?? extractKey(data["zen"]);
		if (key) return key;
	}
	return null;
}

/**
 * Codex auth record from the same files the Codex CLI writes.
 */
async function resolveCodexAuth(): Promise<CodexAuthRecord | null> {
	const candidates = [
		...(process.env.CODEX_HOME ? [join(process.env.CODEX_HOME, "auth.json")] : []),
		join(homedir(), ".config", "codex", "auth.json"),
		join(homedir(), ".codex", "auth.json"),
	];
	for (const path of candidates) {
		const data = await readJson(path);
		if (!data) continue;
		const tokens = (data.tokens ?? {}) as Record<string, unknown>;
		const accessToken = tokens.access_token;
		if (typeof accessToken !== "string" || accessToken.length === 0) continue;
		const refreshToken = typeof tokens.refresh_token === "string" ? tokens.refresh_token : undefined;
		const accountId = typeof tokens.account_id === "string" ? tokens.account_id : undefined;
		return { path, accessToken, refreshToken, accountId };
	}
	return null;
}

// --- Fetch helpers ---

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
	const response = await fetch(url, { headers });
	if (!response.ok) {
		throw new Error(`${url} returned ${response.status}`);
	}
	return response.json();
}

async function fetchOpenCodeGoUsage(apiKey: string): Promise<OpenCodeGoUsage> {
	const json = (await fetchJson(OPENCODE_USAGE_URL, {
		Authorization: `Bearer ${apiKey}`,
		Accept: "application/json",
		"User-Agent": BROWSER_USER_AGENT,
	})) as { usage?: OpenCodeGoUsage };
	if (!json.usage) throw new Error("opencode usage response missing usage");
	return json.usage;
}

async function callCodexApi(
	token: string,
	accountId?: string,
): Promise<CodexUsage | null> {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
		Accept: "application/json",
		"User-Agent": BROWSER_USER_AGENT,
	};
	if (accountId) headers["ChatGPT-Account-Id"] = accountId;
	try {
		return (await fetchJson(CODEX_USAGE_URL, headers)) as CodexUsage;
	} catch (error) {
		const status = error instanceof Error && /returned (\d+)/.exec(error.message)?.[1];
		if (status === "401" || status === "403") return null; // needs auth
		throw error;
	}
}

async function refreshCodexToken(refreshToken: string): Promise<{ access_token?: string; refresh_token?: string } | null> {
	const params = new URLSearchParams({
		grant_type: "refresh_token",
		client_id: CODEX_CLIENT_ID,
		refresh_token: refreshToken,
	});
	try {
		const response = await fetch(CODEX_TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
		});
		if (!response.ok) return null;
		return (await response.json()) as { access_token?: string; refresh_token?: string };
	} catch {
		return null;
	}
}

async function saveCodexAuth(record: CodexAuthRecord, refreshed: { access_token?: string; refresh_token?: string }): Promise<void> {
	try {
		const data = (await readJson(record.path)) ?? {};
		const tokens = ((data.tokens ?? {}) as Record<string, unknown>) ?? {};
		data.tokens = {
			...tokens,
			access_token: refreshed.access_token ?? tokens.access_token,
			refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
		};
		await writeFile(record.path, JSON.stringify(data, null, 2), { mode: 0o600 });
	} catch {
		// Non-fatal; the next call can refresh again.
	}
}

async function fetchCodexUsage(record: CodexAuthRecord): Promise<CodexUsage> {
	let usage = await callCodexApi(record.accessToken, record.accountId);
	if (usage === null && record.refreshToken) {
		const refreshed = await refreshCodexToken(record.refreshToken);
		if (refreshed?.access_token) {
			await saveCodexAuth(record, refreshed);
			usage = await callCodexApi(refreshed.access_token, record.accountId);
		}
	}
	if (usage === null) throw new Error("codex usage requires auth");
	return usage;
}

// --- Formatting ---

function formatGoUsage(usage: OpenCodeGoUsage | null): string | null {
	if (!usage) return null;
	return `${usage.rolling.percent}/${usage.weekly.percent}/${usage.monthly.percent}%`;
}

function formatCodexUsage(usage: CodexUsage | null): string | null {
	if (!usage) return null;
	const primary = usage.rate_limit?.primary_window;
	if (!primary) return null;
	return `${primary.used_percent ?? 0}%`;
}

function codexResetAt(usage: CodexUsage | null): string | null {
	const resetAt = usage?.rate_limit?.primary_window?.reset_at;
	if (typeof resetAt !== "number" || resetAt <= 0) return null;
	return new Date(resetAt * 1000).toLocaleString("ja-JP", {
		month: "numeric",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

// --- Extension ---

export const __usageStatusInternals = {
	fetchOpenCodeGoUsage,
	fetchCodexUsage,
	resolveOpenCodeGoKey,
	resolveCodexAuth,
	formatGoUsage,
	formatCodexUsage,
};

export default function usageStatusExtension(pi: ExtensionAPI) {
	let timer: ReturnType<typeof setInterval> | null = null;
	let refreshing = false;

	const fetchAll = async (): Promise<FetchedUsage> => {
		const result: FetchedUsage = { go: null, codex: null, goError: null, codexError: null };

		const goKey = await resolveOpenCodeGoKey();
		if (goKey) {
			try {
				result.go = await fetchOpenCodeGoUsage(goKey);
			} catch (error) {
				result.goError = error instanceof Error ? error.message : String(error);
			}
		} else {
			result.goError = "no opencode-go key";
		}

		const codexAuth = await resolveCodexAuth();
		if (codexAuth) {
			try {
				result.codex = await fetchCodexUsage(codexAuth);
			} catch (error) {
				result.codexError = error instanceof Error ? error.message : String(error);
			}
		} else {
			result.codexError = "no codex auth";
		}

		return result;
	};

	const renderStatus = (ctx: ExtensionContext, usage: FetchedUsage): void => {
		const theme = ctx.ui.theme;
		const dim = (text: string): string => theme.fg("dim", text);
		const parts: string[] = [];

		const go = formatGoUsage(usage.go);
		if (go) {
			parts.push(`${dim("go")} ${go}`);
		} else if (usage.goError) {
			parts.push(`${dim("go")} ${dim("n/a")}`);
		}

		const codex = formatCodexUsage(usage.codex);
		if (codex) {
			parts.push(`${dim("codex")} ${codex}`);
		} else if (usage.codexError) {
			parts.push(`${dim("codex")} ${dim("n/a")}`);
		}

		if (parts.length === 0) {
			ctx.ui.setStatus(STATUS_KEY, undefined);
			return;
		}
		ctx.ui.setStatus(STATUS_KEY, parts.join(dim(" · ")));
	};

	const refresh = async (ctx: ExtensionContext): Promise<FetchedUsage> => {
		if (refreshing) return await Promise.resolve({ go: null, codex: null, goError: null, codexError: null });
		refreshing = true;
		try {
			const usage = await fetchAll();
			renderStatus(ctx, usage);
			return usage;
		} finally {
			refreshing = false;
		}
	};

	pi.on("session_start", async (_event, ctx) => {
		await refresh(ctx);
		if (timer === null) {
			timer = setInterval(() => {
				void refresh(ctx);
			}, REFRESH_INTERVAL_MS);
		}
	});

	pi.on("session_shutdown", () => {
		if (timer !== null) {
			clearInterval(timer);
			timer = null;
		}
	});

	// Usage moves after every run, so refresh once the agent settles.
	pi.on("agent_settled", async (_event, ctx) => {
		await refresh(ctx);
	});

	pi.registerCommand("usage", {
		description: "Show subscription usage quota (OpenCode Go / Codex)",
		handler: async (_args, ctx) => {
			const usage = await refresh(ctx);
			const theme = ctx.ui.theme;
			const lines: string[] = [];

			if (usage.go) {
				lines.push(
					theme.fg("accent", "OpenCode Go"),
					`  rolling ${usage.go.rolling.percent}% (reset ${usage.go.rolling.resetsAt ?? "?"})`,
					`  weekly ${usage.go.weekly.percent}% (reset ${usage.go.weekly.resetsAt ?? "?"})`,
					`  monthly ${usage.go.monthly.percent}% (reset ${usage.go.monthly.resetsAt ?? "?"})`,
				);
			} else {
				lines.push(theme.fg("accent", "OpenCode Go"), `  ${theme.fg("dim", usage.goError ?? "n/a")}`);
			}

			const primary = usage.codex?.rate_limit?.primary_window;
			if (usage.codex && primary) {
				const plan = usage.codex.plan_type ?? "?";
				const reset = codexResetAt(usage.codex);
				lines.push(
					theme.fg("accent", "Codex"),
					`  plan ${plan} · used ${primary.used_percent ?? 0}%${reset ? ` · reset ${reset}` : ""}`,
				);
			} else {
				lines.push(theme.fg("accent", "Codex"), `  ${theme.fg("dim", usage.codexError ?? "n/a")}`);
			}

			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}
