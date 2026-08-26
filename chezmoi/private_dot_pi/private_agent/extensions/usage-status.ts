/**
 * Usage Status Extension
 *
 * Shows subscription quota as a 4-line widget (below the editor):
 *   - OpenCode Go  : rolling / weekly / monthly usage (undocumented API)
 *   - Codex        : ChatGPT subscription rate-limit windows (undocumented API)
 *   - Z.ai         : GLM Coding Plan quota windows (undocumented API)
 *   - Grok / xAI   : SuperGrok weekly (or monthly) usage pool (undocumented CLI billing API)
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
 *   - Z.ai: GET https://api.z.ai/api/monitor/usage/quota/limit
 *     Bearer key from ~/.pi/agent/auth.json (zai), then ZAI_API_KEY.
 *     Response: { data: { limits: [{ type, unit, percentage, nextResetTime }], level } }.
 *     Quota windows are identified by `unit` regardless of limit type:
 *     unit 3 = rolling 5h, unit 6 = weekly, unit 5 = monthly web tools.
 *   - Grok: GET https://cli-chat-proxy.grok.com/v1/billing?format=credits
 *     Bearer access token from ~/.pi/agent/auth.json (xai OAuth), then ~/.grok/auth.json.
 *     On 401/403 the token is refreshed via auth.x.ai/oauth2/token and saved back.
 *     Response: { config: { creditUsagePercent, currentPeriod: { type, start, end } } }.
 *     proto3 omits zero scalars, so a missing creditUsagePercent with a period is 0%.
 *     Plan label comes from GET /v1/settings (subscription_tier_display).
 *
 * Both endpoints are undocumented and may change without notice.
 * A browser-like User-Agent is required (Cloudflare / WAF).
 */

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const WIDGET_KEY = "usage";
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const QUOTA_OBSERVATION_ROOT = join(homedir(), ".local", "share", "chezmoi", "observe", "llm-usage", "state", "quota");
const QUOTA_CONFIG_PATH = join(homedir(), ".local", "share", "chezmoi", "observe", "llm-usage", "state", "quota-config.json");
const QUOTA_ACCOUNT_ALIAS = "default";

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

// --- Z.ai / GLM Coding Plan ---
const ZAI_USAGE_URL = "https://api.z.ai/api/monitor/usage/quota/limit";

// Window kinds are encoded by `unit` regardless of the limit type
// (TOKENS_LIMIT / CREDIT_LIMIT / TIME_LIMIT):
//   unit 3 = rolling 5-hour quota, unit 6 = weekly, unit 5 = monthly web tools.
const ZAI_UNIT_FIVE_HOUR = 3;
const ZAI_UNIT_WEEKLY = 6;
const ZAI_UNIT_MONTHLY_TOOLS = 5;

// Window durations for elapsed % calculation (GLM Coding Plan).
const ZAI_FIVE_HOUR_WINDOW_SECONDS = 5 * 60 * 60;
const ZAI_WEEKLY_WINDOW_SECONDS = 7 * 24 * 60 * 60;
const ZAI_MONTHLY_TOOLS_WINDOW_SECONDS = 30 * 24 * 60 * 60;

// --- Grok / SuperGrok subscription ---
const GROK_BILLING_URL = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
const GROK_SETTINGS_URL = "https://cli-chat-proxy.grok.com/v1/settings";
const GROK_TOKEN_URL = "https://auth.x.ai/oauth2/token";
const GROK_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const GROK_TOKEN_AUTH = "xai-grok-cli";
const GROK_REFRESH_SKEW_MS = 5 * 60 * 1000;
const GROK_DEFAULT_TOKEN_LIFETIME_SECONDS = 3600;
const GROK_WEEKLY_WINDOW_SECONDS = 7 * 24 * 60 * 60;
const GROK_MONTHLY_WINDOW_SECONDS = 30 * 24 * 60 * 60;

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

type ZaiLimit = {
	type: string;
	unit: number;
	percentage?: number;
	nextResetTime?: number;
};

type ZaiUsageResponse = {
	success?: boolean;
	msg?: string;
	data?: { limits?: ZaiLimit[]; level?: string } | null;
};

type ZaiWindow = { percent: number; resetAtMs: number | null };

type ZaiUsage = {
	level?: string;
	fiveHour: ZaiWindow | null;
	weekly: ZaiWindow | null;
	monthlyTools: ZaiWindow | null;
};

type XaiAuthRecord = {
	path: string;
	accessToken: string;
	refreshToken?: string;
	expires?: number;
};

type GrokUsage = {
	percent: number;
	resetAtMs: number | null;
	windowSeconds: number;
	level?: string;
};

type QuotaObservationWindow = {
	kind: string;
	usedPercent: number;
	resetAt: string | null;
};

type QuotaObservation = {
	schemaVersion: 1;
	kind: "quota_observation";
	observedAt: string;
	provider: string;
	accountAlias: string;
	windows: QuotaObservationWindow[];
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

/**
 * Z.ai (GLM Coding Plan) API key from pi's auth store.
 */
async function resolveZaiKey(): Promise<string | null> {
	if (process.env.ZAI_API_KEY) return process.env.ZAI_API_KEY;
	const data = await readJson(join(homedir(), ".pi", "agent", "auth.json"));
	if (!data) return null;
	return extractKey(data["zai"]);
}

function oauthFromPiXai(entry: unknown, path: string): XaiAuthRecord | null {
	if (!entry || typeof entry !== "object") return null;
	const value = entry as Record<string, unknown>;
	if (value.type !== "oauth") return null;
	const accessToken = value.access;
	if (typeof accessToken !== "string" || accessToken.length <= 8) return null;
	const record: XaiAuthRecord = { path, accessToken };
	if (typeof value.refresh === "string" && value.refresh.length > 0) record.refreshToken = value.refresh;
	if (typeof value.expires === "number" && Number.isFinite(value.expires)) record.expires = value.expires;
	return record;
}

function oauthFromGrokCliEntry(entry: unknown, path: string): XaiAuthRecord | null {
	if (!entry || typeof entry !== "object") return null;
	const value = entry as Record<string, unknown>;
	const accessToken = typeof value.key === "string" ? value.key : typeof value.access === "string" ? value.access : null;
	if (accessToken === null || accessToken.length <= 8) return null;
	const refreshToken =
		typeof value.refresh_token === "string"
			? value.refresh_token
			: typeof value.refresh === "string"
				? value.refresh
				: undefined;
	const expires =
		typeof value.expires_at === "number"
			? value.expires_at
			: typeof value.expires === "number"
				? value.expires
				: undefined;
	const record: XaiAuthRecord = { path, accessToken };
	if (refreshToken && refreshToken.length > 0) record.refreshToken = refreshToken;
	if (typeof expires === "number" && Number.isFinite(expires)) record.expires = expires;
	return record;
}

function oauthFromGrokCliFile(data: Record<string, unknown>, path: string): XaiAuthRecord | null {
	const direct = oauthFromGrokCliEntry(data, path);
	if (direct) return direct;
	const preferred: XaiAuthRecord[] = [];
	const rest: XaiAuthRecord[] = [];
	for (const [name, entry] of Object.entries(data)) {
		const record = oauthFromGrokCliEntry(entry, path);
		if (!record) continue;
		(name.includes("auth.x.ai") ? preferred : rest).push(record);
	}
	return preferred[0] ?? rest[0] ?? null;
}

/**
 * SuperGrok / xAI subscription OAuth from pi's auth store, then Grok CLI.
 * API keys cannot read the CLI billing backend.
 */
async function resolveXaiAuth(): Promise<XaiAuthRecord | null> {
	const piAuthPath = join(homedir(), ".pi", "agent", "auth.json");
	const piAuth = await readJson(piAuthPath);
	if (piAuth) {
		const record = oauthFromPiXai(piAuth["xai"], piAuthPath);
		if (record) return record;
	}

	const grokCandidates = [
		...(process.env.GROK_HOME ? [join(process.env.GROK_HOME, "auth.json")] : []),
		join(homedir(), ".grok", "auth.json"),
	];
	for (const path of grokCandidates) {
		const data = await readJson(path);
		if (!data) continue;
		const record = oauthFromGrokCliFile(data, path);
		if (record) return record;
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

function toZaiWindow(limits: ZaiLimit[], unit: number): ZaiWindow | null {
	const limit = limits.find((entry) => entry.unit === unit);
	if (!limit || typeof limit.percentage !== "number") return null;
	return {
		percent: limit.percentage,
		resetAtMs: typeof limit.nextResetTime === "number" ? limit.nextResetTime : null,
	};
}

async function fetchZaiUsage(apiKey: string): Promise<ZaiUsage> {
	const json = (await fetchJson(ZAI_USAGE_URL, {
		Authorization: `Bearer ${apiKey}`,
		Accept: "application/json",
		"User-Agent": BROWSER_USER_AGENT,
	})) as ZaiUsageResponse;
	// Z.ai returns HTTP 200 with an error body: { success: false, msg: ... }
	if (json.success === false) {
		throw new Error(`z.ai api error: ${json.msg ?? "unknown"}`);
	}
	const limits = json.data?.limits;
	if (!Array.isArray(limits)) throw new Error("z.ai usage response missing limits");
	const usage: ZaiUsage = {
		fiveHour: toZaiWindow(limits, ZAI_UNIT_FIVE_HOUR),
		weekly: toZaiWindow(limits, ZAI_UNIT_WEEKLY),
		monthlyTools: toZaiWindow(limits, ZAI_UNIT_MONTHLY_TOOLS),
	};
	if (!usage.fiveHour && !usage.weekly) throw new Error("z.ai usage response missing quota windows");
	if (typeof json.data?.level === "string" && json.data.level.length > 0) usage.level = json.data.level;
	return usage;
}

function grokHeaders(token: string): Record<string, string> {
	return {
		Authorization: `Bearer ${token}`,
		Accept: "application/json",
		"User-Agent": BROWSER_USER_AGENT,
		"X-XAI-Token-Auth": GROK_TOKEN_AUTH,
	};
}

async function callGrokJson(url: string, token: string): Promise<unknown | null> {
	try {
		return await fetchJson(url, grokHeaders(token));
	} catch (error) {
		const status = error instanceof Error && /returned (\d+)/.exec(error.message)?.[1];
		if (status === "401" || status === "403") return null;
		throw error;
	}
}

async function refreshXaiToken(
	refreshToken: string,
): Promise<{ access: string; refresh?: string; expires: number } | null> {
	const params = new URLSearchParams({
		grant_type: "refresh_token",
		client_id: GROK_CLIENT_ID,
		refresh_token: refreshToken,
	});
	try {
		const response = await fetch(GROK_TOKEN_URL, {
			method: "POST",
			headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
		});
		if (!response.ok) return null;
		const body = (await response.json()) as Record<string, unknown>;
		if (typeof body.access_token !== "string" || body.access_token.length === 0) return null;
		const expiresIn =
			typeof body.expires_in === "number" && Number.isFinite(body.expires_in) && body.expires_in > 0
				? body.expires_in
				: GROK_DEFAULT_TOKEN_LIFETIME_SECONDS;
		const refreshed: { access: string; refresh?: string; expires: number } = {
			access: body.access_token,
			expires: Date.now() + expiresIn * 1000 - GROK_REFRESH_SKEW_MS,
		};
		if (typeof body.refresh_token === "string" && body.refresh_token.length > 0) {
			refreshed.refresh = body.refresh_token;
		}
		return refreshed;
	} catch {
		return null;
	}
}

async function saveXaiAuth(
	record: XaiAuthRecord,
	refreshed: { access: string; refresh?: string; expires: number },
): Promise<void> {
	try {
		const data = (await readJson(record.path)) ?? {};
		const existing = data["xai"];
		if (existing && typeof existing === "object" && !Array.isArray(existing)) {
			const current = existing as Record<string, unknown>;
			if (current.type === "oauth" || typeof current.access === "string") {
				data["xai"] = {
					...current,
					type: "oauth",
					access: refreshed.access,
					refresh: refreshed.refresh ?? current.refresh,
					expires: refreshed.expires,
				};
				await writeFile(record.path, JSON.stringify(data, null, 2), { mode: 0o600 });
				return;
			}
		}
	} catch {
		// Non-fatal; the next call can refresh again.
	}
}

function parseIsoMs(value: unknown): number | null {
	if (typeof value !== "string" || value.length === 0) return null;
	const ms = Date.parse(value);
	return Number.isFinite(ms) ? ms : null;
}

function centVal(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (!value || typeof value !== "object") return null;
	const val = (value as Record<string, unknown>).val;
	return typeof val === "number" && Number.isFinite(val) ? val : null;
}

function grokWindowSeconds(
	periodType: string | undefined,
	startMs: number | null,
	endMs: number | null,
): number {
	if (startMs !== null && endMs !== null && endMs > startMs) {
		return Math.round((endMs - startMs) / 1000);
	}
	if (periodType?.includes("MONTHLY")) return GROK_MONTHLY_WINDOW_SECONDS;
	return GROK_WEEKLY_WINDOW_SECONDS;
}

function parseGrokUsage(billing: unknown, settings: unknown): GrokUsage {
	if (!billing || typeof billing !== "object") throw new Error("grok usage response missing config");
	const config = (billing as Record<string, unknown>).config;
	if (!config || typeof config !== "object") throw new Error("grok usage response missing config");
	const cfg = config as Record<string, unknown>;
	const period =
		cfg.currentPeriod && typeof cfg.currentPeriod === "object" && !Array.isArray(cfg.currentPeriod)
			? (cfg.currentPeriod as Record<string, unknown>)
			: null;
	const periodType = period && typeof period.type === "string" ? period.type : undefined;
	const startMs = parseIsoMs(period?.start ?? cfg.billingPeriodStart);
	const resetAtMs = parseIsoMs(period?.end ?? cfg.billingPeriodEnd);

	let percent: number | null = null;
	if (typeof cfg.creditUsagePercent === "number" && Number.isFinite(cfg.creditUsagePercent)) {
		percent = Math.min(100, Math.max(0, cfg.creditUsagePercent));
	} else {
		const used = centVal(cfg.used);
		const limit = centVal(cfg.monthlyLimit);
		if (used !== null && limit !== null && limit > 0) {
			percent = Math.min(100, Math.max(0, (used / limit) * 100));
		} else if (resetAtMs !== null) {
			// proto3 JSON omits zero-valued scalars; a live period with no percent is 0%.
			percent = 0;
		}
	}
	if (percent === null) throw new Error("grok usage response missing quota windows");

	const usage: GrokUsage = {
		percent,
		resetAtMs,
		windowSeconds: grokWindowSeconds(periodType, startMs, resetAtMs),
	};
	if (settings && typeof settings === "object") {
		const display = (settings as Record<string, unknown>).subscription_tier_display;
		if (typeof display === "string" && display.length > 0) usage.level = display;
	}
	return usage;
}

async function applyXaiRefresh(
	record: XaiAuthRecord,
): Promise<string | null> {
	if (!record.refreshToken) return null;
	const refreshed = await refreshXaiToken(record.refreshToken);
	if (!refreshed) return null;
	record.accessToken = refreshed.access;
	record.refreshToken = refreshed.refresh ?? record.refreshToken;
	record.expires = refreshed.expires;
	await saveXaiAuth(record, refreshed);
	return refreshed.access;
}

async function fetchGrokUsage(record: XaiAuthRecord): Promise<GrokUsage> {
	const expired = typeof record.expires === "number" && record.expires <= Date.now();
	let token = record.accessToken;
	if (expired) {
		const refreshed = await applyXaiRefresh(record);
		if (!refreshed) throw new Error("grok usage requires auth");
		token = refreshed;
	}

	let billing = await callGrokJson(GROK_BILLING_URL, token);
	if (billing === null) {
		const refreshed = await applyXaiRefresh(record);
		if (!refreshed) throw new Error("grok usage requires auth");
		token = refreshed;
		billing = await callGrokJson(GROK_BILLING_URL, token);
	}
	if (billing === null) throw new Error("grok usage requires auth");

	const settings = await callGrokJson(GROK_SETTINGS_URL, token);
	return parseGrokUsage(billing, settings);
}

const toObservationTimestamp = (resetAtMs: number | null): string | null =>
	resetAtMs === null ? null : new Date(resetAtMs).toISOString();

const toCodexObservationWindow = (
	kind: string,
	window: CodexRateWindow,
): QuotaObservationWindow | null => {
	if (!window || typeof window.used_percent !== "number" || !Number.isFinite(window.used_percent)) return null;
	return {
		kind,
		usedPercent: window.used_percent,
		resetAt: typeof window.reset_at === "number" ? new Date(window.reset_at * 1000).toISOString() : null,
	};
};

const quotaObservations = (
	go: OpenCodeGoUsage | null,
	codex: CodexUsage | null,
	zai: ZaiUsage | null,
	grok: GrokUsage | null,
	observedAt: string,
	accountAliases: Readonly<Record<string, string>> = {},
): QuotaObservation[] => {
	const observations: QuotaObservation[] = [];
	const create = (provider: string, windows: QuotaObservationWindow[]): void => {
		if (windows.length === 0) return;
		observations.push({
			schemaVersion: 1,
			kind: "quota_observation",
			observedAt,
			provider,
			accountAlias: accountAliases[provider] ?? QUOTA_ACCOUNT_ALIAS,
			windows,
		});
	};

	if (go) {
		create("opencode-go", [
			{ kind: "rolling-5h", usedPercent: go.rolling.percent, resetAt: go.rolling.resetsAt },
			{ kind: "weekly", usedPercent: go.weekly.percent, resetAt: go.weekly.resetsAt },
			{ kind: "monthly", usedPercent: go.monthly.percent, resetAt: go.monthly.resetsAt },
		]);
	}
	if (codex) {
		const windows: QuotaObservationWindow[] = [];
		const primary = toCodexObservationWindow("primary", codex.rate_limit?.primary_window);
		if (primary) windows.push(primary);
		const secondary = toCodexObservationWindow("secondary", codex.rate_limit?.secondary_window);
		if (secondary) windows.push(secondary);
		const codeReview = toCodexObservationWindow("code-review", codex.code_review_rate_limit?.primary_window);
		if (codeReview) windows.push(codeReview);
		for (const additional of codex.additional_rate_limits ?? []) {
			if (!additional.limit_name) continue;
			const window = toCodexObservationWindow(
				`additional:${additional.limit_name}`,
				additional.rate_limit?.primary_window,
			);
			if (window) windows.push(window);
		}
		create("openai-codex", windows);
	}
	if (zai) {
		const windows: QuotaObservationWindow[] = [];
		if (zai.fiveHour) {
			windows.push({ kind: "rolling-5h", usedPercent: zai.fiveHour.percent, resetAt: toObservationTimestamp(zai.fiveHour.resetAtMs) });
		}
		if (zai.weekly) {
			windows.push({ kind: "weekly", usedPercent: zai.weekly.percent, resetAt: toObservationTimestamp(zai.weekly.resetAtMs) });
		}
		if (zai.monthlyTools) {
			windows.push({ kind: "monthly-tools", usedPercent: zai.monthlyTools.percent, resetAt: toObservationTimestamp(zai.monthlyTools.resetAtMs) });
		}
		create("zai", windows);
	}
	if (grok) {
		create("xai", [{
			kind: formatWindowSeconds(grok.windowSeconds),
			usedPercent: grok.percent,
			resetAt: toObservationTimestamp(grok.resetAtMs),
		}]);
	}
	return observations;
};

const resolveQuotaAccountAliases = async (): Promise<Record<string, string>> => {
	const config = await readJson(QUOTA_CONFIG_PATH);
	const aliases = config?.accountAliases;
	if (!aliases || typeof aliases !== "object" || Array.isArray(aliases)) return {};
	const configured: Record<string, string> = {};
	for (const [provider, alias] of Object.entries(aliases)) {
		if (typeof alias === "string" && alias.length > 0) configured[provider] = alias;
	}
	return configured;
};

const appendQuotaObservations = async (observations: QuotaObservation[]): Promise<void> => {
	if (observations.length === 0) return;
	const observedDate = observations[0]?.observedAt.slice(0, 10);
	if (!observedDate) return;
	const outputPath = join(QUOTA_OBSERVATION_ROOT, `${observedDate}.jsonl`);
	await mkdir(QUOTA_OBSERVATION_ROOT, { recursive: true, mode: 0o700 });
	await appendFile(outputPath, observations.map((observation) => JSON.stringify(observation)).join("\n") + "\n", {
		encoding: "utf-8",
		mode: 0o600,
	});
};

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
	const displayPercent = Math.round(percent);
	const pctText = theme.fg(paceTone(percent, elapsed ?? 0), `${displayPercent}%`);
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
	fetchZaiUsage,
	resolveZaiKey,
	fetchGrokUsage,
	resolveXaiAuth,
	parseGrokUsage,
	quotaObservations,
	calcElapsedPercent,
	paceTone,
	formatWindowSeconds,
	renderWindow,
};

export default function usageStatusExtension(pi: ExtensionAPI) {
	let timer: ReturnType<typeof setInterval> | null = null;
	let refreshing = false;
	let last: { go: OpenCodeGoUsage | null; codex: CodexUsage | null; zai: ZaiUsage | null; grok: GrokUsage | null } = {
		go: null,
		codex: null,
		zai: null,
		grok: null,
	};

	const fetchAll = async (): Promise<{
		go: OpenCodeGoUsage | null;
		codex: CodexUsage | null;
		zai: ZaiUsage | null;
		grok: GrokUsage | null;
		errors: string[];
	}> => {
		const result: {
			go: OpenCodeGoUsage | null;
			codex: CodexUsage | null;
			zai: ZaiUsage | null;
			grok: GrokUsage | null;
			errors: string[];
		} = {
			go: null,
			codex: null,
			zai: null,
			grok: null,
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

		const zaiKey = await resolveZaiKey();
		if (zaiKey) {
			try {
				result.zai = await fetchZaiUsage(zaiKey);
			} catch (error) {
				result.errors.push(`zai: ${error instanceof Error ? error.message : String(error)}`);
			}
		} else {
			result.errors.push("zai: no key");
		}

		const xaiAuth = await resolveXaiAuth();
		if (xaiAuth) {
			try {
				result.grok = await fetchGrokUsage(xaiAuth);
			} catch (error) {
				result.errors.push(`grok: ${error instanceof Error ? error.message : String(error)}`);
			}
		} else {
			result.errors.push("grok: no auth");
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

		// --- Line 3: Z.ai / GLM Coding Plan (labels = window length: 5h / 7d / tools 1m) ---
		const zai = last.zai;
		if (zai) {
			const zaiParts: string[] = [];
			if (zai.fiveHour) {
				zaiParts.push(
					renderWindow(theme, "5h", zai.fiveHour.percent, zai.fiveHour.resetAtMs, ZAI_FIVE_HOUR_WINDOW_SECONDS, {
						showReset: zai.fiveHour.percent > 0,
						showElapsed: true,
					}),
				);
			}
			if (zai.weekly) {
				zaiParts.push(
					renderWindow(theme, "7d", zai.weekly.percent, zai.weekly.resetAtMs, ZAI_WEEKLY_WINDOW_SECONDS, {
						showReset: true,
						showElapsed: true,
					}),
				);
			}
			if (zai.monthlyTools) {
				zaiParts.push(
					renderWindow(
						theme,
						"tools1m",
						zai.monthlyTools.percent,
						zai.monthlyTools.resetAtMs,
						ZAI_MONTHLY_TOOLS_WINDOW_SECONDS,
						{ showReset: true, showElapsed: true },
					),
				);
			}
			const tier = zai.level ? ` ${theme.fg("dim", `(${zai.level})`)}` : "";
			lines.push(
				theme.fg("dim", "zai ") + tier + (zaiParts.length > 0 ? zaiParts.join(theme.fg("dim", " · ")) : theme.fg("dim", "n/a")),
			);
		} else {
			lines.push(theme.fg("dim", "zai n/a"));
		}

		// --- Line 4: Grok / SuperGrok weekly (or monthly) pool ---
		const grok = last.grok;
		if (grok) {
			const grokParts = [
				renderWindow(
					theme,
					formatWindowSeconds(grok.windowSeconds),
					grok.percent,
					grok.resetAtMs,
					grok.windowSeconds,
					{ showReset: true, showElapsed: true },
				),
			];
			const tier = grok.level ? ` ${theme.fg("dim", `(${grok.level})`)}` : "";
			lines.push(theme.fg("dim", "grok ") + tier + grokParts.join(theme.fg("dim", " · ")));
		} else {
			lines.push(theme.fg("dim", "grok n/a"));
		}

		ctx.ui.setWidget(WIDGET_KEY, lines, { placement: "belowEditor" });
	};

	const refresh = async (ctx: ExtensionContext): Promise<void> => {
		if (refreshing) return;
		refreshing = true;
		try {
			const { go, codex, zai, grok, errors } = await fetchAll();
			try {
				await appendQuotaObservations(
					quotaObservations(go, codex, zai, grok, new Date().toISOString(), await resolveQuotaAccountAliases()),
				);
			} catch (error) {
				console.warn(`usage quota observation write failed: ${error instanceof Error ? error.message : String(error)}`);
			}
			if (go) last.go = go;
			if (codex) last.codex = codex;
			if (zai) last.zai = zai;
			if (grok) last.grok = grok;
			if (errors.length > 0 && !go && !codex && !zai && !grok) {
				// All sources failed: fall back to whatever we had before.
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
		description: "Refresh and show subscription usage quota (OpenCode Go / Codex / Z.ai / Grok)",
		handler: async (_args, ctx) => {
			await refresh(ctx);
			const theme = ctx.ui.theme;
			const lines: string[] = [];
			const go = last.go;
			const codex = last.codex;
			const zai = last.zai;
			const grok = last.grok;

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

			if (zai) {
				lines.push(theme.fg("accent", `Z.ai${zai.level ? ` (${zai.level})` : ""}`));
				const zaiRows: [string, ZaiWindow | null][] = [
					["5h (rolling):", zai.fiveHour],
					["7d (weekly): ", zai.weekly],
					["tools (1m):  ", zai.monthlyTools],
				];
				for (const [label, window] of zaiRows) {
					if (!window) continue;
					const reset =
						window.resetAtMs !== null ? ` (reset ${new Date(window.resetAtMs).toLocaleString("ja-JP")})` : "";
					lines.push(`  ${label} ${window.percent}% used${reset}`);
				}
			} else {
				lines.push(theme.fg("accent", "Z.ai"), theme.fg("dim", "  n/a"));
			}

			if (grok) {
				const reset =
					grok.resetAtMs !== null ? ` (reset ${new Date(grok.resetAtMs).toLocaleString("ja-JP")})` : "";
				lines.push(
					theme.fg("accent", `Grok${grok.level ? ` (${grok.level})` : ""}`),
					`  ${formatWindowSeconds(grok.windowSeconds)} window: ${grok.percent}% used${reset}`,
				);
			} else {
				lines.push(theme.fg("accent", "Grok"), theme.fg("dim", "  n/a"));
			}

			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}
