/**
 * Usage Status Extension
 *
 * Shows subscription quota as a 2-line widget (below the editor):
 *   - OpenCode Go  : rolling / weekly / monthly usage (undocumented API)
 *   - Codex        : ChatGPT subscription rate-limit windows (undocumented API)
 *
 * Each quota window shows the utilization % colored by pace against the
 * elapsed % of the window (same idea as ~/.claude/statusline.sh):
 *   usage < elapsed            -> green (on pace)
 *   0 <= usage - elapsed < 10  -> yellow (getting close)
 *   usage - elapsed >= 10      -> red (ahead of pace / risk of throttling)
 *
 * Data sources:
 *   - OpenCode Go: GET https://opencode.ai/zen/go/v1/usage
 *     Bearer key from ~/.pi/agent/auth.json (opencode-go), then
 *     ~/.local/share/opencode/auth.json (opencode-go), then OPENCODE_API_KEY.
 *     Response: { usage: { rolling, weekly, monthly: { status, percent, resetsAt } } }
 *   - Codex: GET https://chatgpt.com/backend-api/wham/usage
 *     Bearer access_token from ~/.codex/auth.json (+ ChatGPT-Account-Id).
 *     On 401/403 the token is refreshed via auth.openai.com/oauth/token and
 *     saved back. Response: { plan_type, rate_limit, additional_rate_limits, ... }.
 *
 * Both endpoints are undocumented and may change without notice.
 * A browser-like User-Agent is required (Cloudflare / WAF).
 */

import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const WIDGET_KEY = "usage";
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const BROWSER_USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// --- OpenCode Go ---
const OPENCODE_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";

// Window durations for elapsed % calculation (OpenCode Go plan).
const GO_ROLLING_WINDOW_SECONDS = 5 * 60 * 60; // rolling $12 / 5h
const GO_WEEKLY_WINDOW_SECONDS = 7 * 24 * 60 * 60; // $30 / week
const GO_MONTHLY_WINDOW_SECONDS = 30 * 24 * 60 * 60; // $60 / month

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

type CodexRateWindow = { used_percent?: number; reset_at?: number; limit_window_seconds?: number } | null | undefined;

type CodexAdditionalRateLimit = {
	limit_name?: string;
	rate_limit?: { primary_window?: CodexRateWindow } | null;
};

type CodexUsage = {
	plan_type?: string | null;
	rate_limit?: { primary_window?: CodexRateWindow; secondary_window?: CodexRateWindow } | null;
	code_review_rate_limit?: { primary_window?: CodexRateWindow } | null;
	additional_rate_limits?: CodexAdditionalRateLimit[] | null;
};

type CodexAuthRecord = {
	path: string;
	accessToken: string;
	refreshToken?: string;
	accountId?: string;
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

// --- Pace / formatting helpers (mirrors ~/.claude/statusline.sh) ---

/**
 * Elapsed % of a window, given its reset time and total duration.
 * usage < elapsed -> on pace; usage > elapsed -> ahead of pace.
 */
function calcElapsedPercent(resetAtMs: number, windowSeconds: number): number {
	const now = Date.now();
	const remainingMs = resetAtMs - now;
	const windowMs = windowSeconds * 1000;
	const elapsedMs = windowMs - remainingMs;
	if (elapsedMs < 0) return 0;
	if (elapsedMs > windowMs) return 100;
	return Math.round((elapsedMs / windowMs) * 100);
}

function paceTone(usagePercent: number, elapsedPercent: number): "success" | "warning" | "error" {
	if (usagePercent === 0) return "success"; // nothing consumed
	const diff = usagePercent - elapsedPercent;
	if (diff >= 10) return "error";
	if (diff >= 0) return "warning";
	return "success";
}

function formatClock(epochSeconds: number): string {
	return new Date(epochSeconds * 1000).toLocaleTimeString("ja-JP", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

function formatDate(epochSeconds: number): string {
	const date = new Date(epochSeconds * 1000);
	const today = new Date();
	const sameDay =
		date.getFullYear() === today.getFullYear() &&
		date.getMonth() === today.getMonth() &&
		date.getDate() === today.getDate();
	if (sameDay) return formatClock(epochSeconds);
	return date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function formatWindowSeconds(seconds: number): string {
	const WEEK = 7 * 24 * 60 * 60;
	const DAY = 24 * 60 * 60;
	const HOUR = 60 * 60;
	if (seconds >= 2 * WEEK && seconds % WEEK === 0) return `${seconds / WEEK}w`;
	if (seconds % DAY === 0) return `${seconds / DAY}d`;
	if (seconds % HOUR === 0) return `${seconds / HOUR}h`;
	return `${Math.round(seconds / 60)}m`;
}

/**
 * One quota window: `12%` colored by pace, with reset/elapsed metadata.
 * Rendered as e.g. `W 12% (🔄8/17・52%)` (same shape as ~/.claude/statusline.sh).
 */
function renderWindow(
	theme: ExtensionContext["ui"]["theme"],
	label: string,
	percent: number,
	resetAtMs: number | null,
	windowSeconds: number,
	opts: { showReset?: boolean; showElapsed?: boolean } = {},
): string {
	const elapsed = resetAtMs !== null ? calcElapsedPercent(resetAtMs, windowSeconds) : null;
	const pctText = theme.fg(paceTone(percent, elapsed ?? 0), `${percent}%`);
	const meta: string[] = [];
	if (opts.showReset && resetAtMs !== null) {
		meta.push(`🔄${formatDate(Math.floor(resetAtMs / 1000))}`);
	}
	if (opts.showElapsed && elapsed !== null) {
		meta.push(`${elapsed}%`);
	}
	return meta.length > 0 ? `${label} ${pctText} (${meta.join("・")})` : `${label} ${pctText}`;
}

// --- Extension ---

export const __usageStatusInternals = {
	fetchOpenCodeGoUsage,
	fetchCodexUsage,
	resolveOpenCodeGoKey,
	resolveCodexAuth,
	calcElapsedPercent,
	paceTone,
	formatWindowSeconds,
	renderWindow,
};

export default function usageStatusExtension(pi: ExtensionAPI) {
	let timer: ReturnType<typeof setInterval> | null = null;
	let refreshing = false;
	let last: { go: OpenCodeGoUsage | null; codex: CodexUsage | null } = { go: null, codex: null };

	const fetchAll = async (): Promise<{ go: OpenCodeGoUsage | null; codex: CodexUsage | null; errors: string[] }> => {
		const result: { go: OpenCodeGoUsage | null; codex: CodexUsage | null; errors: string[] } = {
			go: null,
			codex: null,
			errors: [],
		};

		const goKey = await resolveOpenCodeGoKey();
		if (goKey) {
			try {
				result.go = await fetchOpenCodeGoUsage(goKey);
			} catch (error) {
				result.errors.push(`go: ${error instanceof Error ? error.message : String(error)}`);
			}
		} else {
			result.errors.push("go: no opencode-go key");
		}

		const codexAuth = await resolveCodexAuth();
		if (codexAuth) {
			try {
				result.codex = await fetchCodexUsage(codexAuth);
			} catch (error) {
				result.errors.push(`codex: ${error instanceof Error ? error.message : String(error)}`);
			}
		} else {
			result.errors.push("codex: no auth");
		}

		return result;
	};

	const renderWidget = (ctx: ExtensionContext): void => {
		const theme = ctx.ui.theme;
		const go = last.go;
		const codex = last.codex;
		const lines: string[] = [];

		// --- Line 1: OpenCode Go (labels = window length: 5h rolling / 7d weekly / 1m monthly) ---
		if (go) {
			const rolling = go.rolling;
			const weekly = go.weekly;
			const monthly = go.monthly;
			const goParts: string[] = [];
			goParts.push(
				renderWindow(theme, "5h", rolling.percent, rolling.resetsAt ? Date.parse(rolling.resetsAt) : null, GO_ROLLING_WINDOW_SECONDS, {
					showReset: rolling.percent > 0,
					showElapsed: true,
				}),
			);
			goParts.push(
				renderWindow(theme, "7d", weekly.percent, weekly.resetsAt ? Date.parse(weekly.resetsAt) : null, GO_WEEKLY_WINDOW_SECONDS, {
					showReset: true,
					showElapsed: true,
				}),
			);
			goParts.push(
				renderWindow(theme, "1m", monthly.percent, monthly.resetsAt ? Date.parse(monthly.resetsAt) : null, GO_MONTHLY_WINDOW_SECONDS, {
					showReset: true,
					showElapsed: true,
				}),
			);
			lines.push(theme.fg("dim", "go ") + goParts.join(theme.fg("dim", " · ")));
		} else {
			lines.push(theme.fg("dim", "go n/a"));
		}

		// --- Line 2: Codex ---
		if (codex) {
			const primary = codex.rate_limit?.primary_window;
			const codexParts: string[] = [];
			if (primary) {
				const windowSeconds = primary.limit_window_seconds ?? 7 * 24 * 60 * 60;
				codexParts.push(
					renderWindow(
						theme,
						formatWindowSeconds(windowSeconds),
						primary.used_percent ?? 0,
						typeof primary.reset_at === "number" ? primary.reset_at * 1000 : null,
						windowSeconds,
						{ showReset: true, showElapsed: true },
					),
				);
			}
			for (const extra of codex.additional_rate_limits ?? []) {
				const extraWindow = extra.rate_limit?.primary_window;
				if (!extraWindow || !(extraWindow.used_percent ?? 0) || !extra.limit_name) continue;
				const label = extra.limit_name.replace(/^GPT-[0-9.]+-Codex-/, "Codex-");
				const windowSeconds = extraWindow.limit_window_seconds ?? 7 * 24 * 60 * 60;
				codexParts.push(
					renderWindow(
						theme,
						label,
						extraWindow.used_percent ?? 0,
						typeof extraWindow.reset_at === "number" ? extraWindow.reset_at * 1000 : null,
						windowSeconds,
						{ showReset: true, showElapsed: true },
					),
				);
			}
			lines.push(theme.fg("dim", "codex ") + (codexParts.length > 0 ? codexParts.join(theme.fg("dim", " · ")) : theme.fg("dim", "n/a")));
		} else {
			lines.push(theme.fg("dim", "codex n/a"));
		}

		ctx.ui.setWidget(WIDGET_KEY, lines, { placement: "belowEditor" });
	};

	const refresh = async (ctx: ExtensionContext): Promise<void> => {
		if (refreshing) return;
		refreshing = true;
		try {
			const { go, codex, errors } = await fetchAll();
			if (go) last.go = go;
			if (codex) last.codex = codex;
			if (errors.length > 0 && !go && !codex) {
				// Both sources failed: fall back to whatever we had before.
			}
			renderWidget(ctx);
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
		description: "Refresh and show subscription usage quota (OpenCode Go / Codex)",
		handler: async (_args, ctx) => {
			await refresh(ctx);
			const theme = ctx.ui.theme;
			const lines: string[] = [];
			const go = last.go;
			const codex = last.codex;

			lines.push(theme.fg("dim", "each window: <used%> (🔄 reset, <elapsed%>) — colored by pace (green=ok, yellow=on pace, red=ahead)"));

			if (go) {
				lines.push(theme.fg("accent", "OpenCode Go"));
				lines.push(`  5h (rolling): ${go.rolling.percent}% used${go.rolling.resetsAt ? ` (reset ${go.rolling.resetsAt})` : ""}`);
				lines.push(`  7d (weekly):  ${go.weekly.percent}% used${go.weekly.resetsAt ? ` (reset ${go.weekly.resetsAt})` : ""}`);
				lines.push(`  1m (monthly): ${go.monthly.percent}% used${go.monthly.resetsAt ? ` (reset ${go.monthly.resetsAt})` : ""}`);
			} else {
				lines.push(theme.fg("accent", "OpenCode Go"), theme.fg("dim", "  n/a"));
			}

			const primary = codex?.rate_limit?.primary_window;
			if (codex && primary) {
				const reset = typeof primary.reset_at === "number" ? new Date(primary.reset_at * 1000).toLocaleString("ja-JP") : "?";
				lines.push(
					theme.fg("accent", "Codex"),
					`  ${formatWindowSeconds(primary.limit_window_seconds ?? 604800)} window: ${primary.used_percent ?? 0}% used (reset ${reset})`,
				);
				for (const extra of codex.additional_rate_limits ?? []) {
					const extraWindow = extra.rate_limit?.primary_window;
					if (!extraWindow || !extra.limit_name) continue;
					lines.push(
						`  ${extra.limit_name}: ${extraWindow.used_percent ?? 0}% used (reset ${typeof extraWindow.reset_at === "number" ? new Date(extraWindow.reset_at * 1000).toLocaleString("ja-JP") : "?"})`,
					);
				}
			} else {
				lines.push(theme.fg("accent", "Codex"), theme.fg("dim", "  n/a"));
			}

			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}
