/**
 * Tests for the usage-status pi extension's Z.ai quota support.
 *
 * The extension lives outside internal/ (it is distributed to
 * ~/.pi/agent/extensions/), but its testable internals are exported via
 * __usageStatusInternals. These tests cover the Z.ai response parsing and
 * key resolution added for the GLM Coding Plan.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { __usageStatusInternals } from "../../../chezmoi/private_dot_pi/private_agent/extensions/usage-status.ts"

const { fetchZaiUsage, resolveZaiKey, fetchGrokUsage, resolveXaiAuth, parseGrokUsage } =
  __usageStatusInternals

const testRootPrefix = path.join(tmpdir(), "usage-status-test-")

let homeDir = ""

const jsonResponse = (body: unknown): Response => {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	})
}

/** Response shape observed from the live API (credit-based lite plan). */
const creditLimitResponse = (): unknown => ({
	code: 200,
	msg: "Operation successful",
	success: true,
	data: {
		level: "lite",
		limits: [
			{ type: "CREDIT_LIMIT", unit: 3, number: 5, percentage: 6, nextResetTime: 1786961964113 },
			{ type: "CREDIT_LIMIT", unit: 6, number: 1, percentage: 1, nextResetTime: 1787548400998 },
		],
	},
})

/** Token-based response shape documented by the reference extension. */
const tokensLimitResponse = (): unknown => ({
	success: true,
	data: {
		level: "pro",
		limits: [
			{ type: "TIME_LIMIT", unit: 5, number: 1, percentage: 42, nextResetTime: 1787756942995 },
			{ type: "TOKENS_LIMIT", unit: 3, percentage: 50, nextResetTime: 1786307528544 },
			{ type: "TOKENS_LIMIT", unit: 6, percentage: 4, nextResetTime: 1786892942997 },
		],
	},
})

describe("fetchZaiUsage", () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("parses CREDIT_LIMIT windows (unit 3 = 5h, unit 6 = weekly)", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(creditLimitResponse())))

		const usage = await fetchZaiUsage("test-key")

		expect(usage.level).toBe("lite")
		expect(usage.fiveHour).toEqual({ percent: 6, resetAtMs: 1786961964113 })
		expect(usage.weekly).toEqual({ percent: 1, resetAtMs: 1787548400998 })
		expect(usage.monthlyTools).toBeNull()
	})

	it("parses TOKENS_LIMIT windows and monthly tools (unit 5)", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(tokensLimitResponse())))

		const usage = await fetchZaiUsage("test-key")

		expect(usage.level).toBe("pro")
		expect(usage.fiveHour).toEqual({ percent: 50, resetAtMs: 1786307528544 })
		expect(usage.weekly).toEqual({ percent: 4, resetAtMs: 1786892942997 })
		expect(usage.monthlyTools).toEqual({ percent: 42, resetAtMs: 1787756942995 })
	})

	it("sends bearer auth and a browser user-agent", async () => {
		const fetchMock = vi.fn(async () => jsonResponse(creditLimitResponse()))
		vi.stubGlobal("fetch", fetchMock)

		await fetchZaiUsage("test-key")

		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
		expect(url).toBe("https://api.z.ai/api/monitor/usage/quota/limit")
		expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key")
		expect((init.headers as Record<string, string>)["User-Agent"]).toContain("Mozilla/5.0")
	})

	it("throws on HTTP 200 error body (success: false)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse({ code: 401, msg: "token expired or incorrect", success: false }),
			),
		)

		await expect(fetchZaiUsage("test-key")).rejects.toThrow(
			"z.ai api error: token expired or incorrect",
		)
	})

	it("throws when limits array is missing", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ success: true, data: {} })))

		await expect(fetchZaiUsage("test-key")).rejects.toThrow("z.ai usage response missing limits")
	})

	it("throws when no 5h/weekly quota window exists", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse({
					success: true,
					data: { limits: [{ type: "TIME_LIMIT", unit: 5, percentage: 10 }] },
				}),
			),
		)

		await expect(fetchZaiUsage("test-key")).rejects.toThrow(
			"z.ai usage response missing quota windows",
		)
	})

	it("skips windows without a percentage and rounds decimals", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse({
					success: true,
					data: {
						limits: [
							{ type: "CREDIT_LIMIT", unit: 3, percentage: 6.4, nextResetTime: 1786961964113 },
							{ type: "TIME_LIMIT", unit: 5 },
							{ type: "CREDIT_LIMIT", unit: 9, percentage: 99 },
						],
					},
				}),
			),
		)

		const usage = await fetchZaiUsage("test-key")

		expect(usage.fiveHour).toEqual({ percent: 6, resetAtMs: 1786961964113 })
		expect(usage.weekly).toBeNull()
		expect(usage.monthlyTools).toBeNull()
		expect(usage.level).toBeUndefined()
	})
})

describe("resolveZaiKey", () => {
	beforeEach(async () => {
		homeDir = await mkdtemp(testRootPrefix)
		await mkdir(path.join(homeDir, ".pi", "agent"), { recursive: true })
		process.env["HOME"] = homeDir
	})

	afterEach(async () => {
		vi.unstubAllEnvs()
		delete process.env["HOME"]
		await rm(homeDir, { recursive: true, force: true })
	})

	it("prefers ZAI_API_KEY over the auth store", async () => {
		await writeFile(
			path.join(homeDir, ".pi", "agent", "auth.json"),
			JSON.stringify({ zai: { type: "api", key: "authstore-key" } }),
			"utf-8",
		)
		vi.stubEnv("ZAI_API_KEY", "env-key")

		expect(await resolveZaiKey()).toBe("env-key")
	})

	it("reads the zai entry from pi's auth.json", async () => {
		await writeFile(
			path.join(homeDir, ".pi", "agent", "auth.json"),
			JSON.stringify({ zai: { type: "api", key: "authstore-key" } }),
			"utf-8",
		)

		expect(await resolveZaiKey()).toBe("authstore-key")
	})

	it("returns null when no auth is configured", async () => {
		expect(await resolveZaiKey()).toBeNull()
	})

	it("returns null for a too-short key", async () => {
		await writeFile(
			path.join(homeDir, ".pi", "agent", "auth.json"),
			JSON.stringify({ zai: { type: "api", key: "short" } }),
			"utf-8",
		)

		expect(await resolveZaiKey()).toBeNull()
	})
})

const weeklyCreditsResponse = (): unknown => ({
	config: {
		creditUsagePercent: 42.5,
		currentPeriod: {
			type: "USAGE_PERIOD_TYPE_WEEKLY",
			start: "2026-08-23T04:51:01.146719+00:00",
			end: "2026-08-30T04:51:01.146719+00:00",
		},
		onDemandCap: { val: 0 },
		onDemandUsed: { val: 0 },
		isUnifiedBillingUser: true,
	},
})

/** Live SuperGrok response observed when usage is 0% (proto3 omits the scalar). */
const omittedPercentCreditsResponse = (): unknown => ({
	config: {
		currentPeriod: {
			type: "USAGE_PERIOD_TYPE_WEEKLY",
			start: "2026-08-23T04:51:01.146719+00:00",
			end: "2026-08-30T04:51:01.146719+00:00",
		},
		onDemandCap: { val: 0 },
		onDemandUsed: { val: 0 },
		isUnifiedBillingUser: true,
		prepaidBalance: { val: 0 },
		billingPeriodStart: "2026-08-23T04:51:01.146719+00:00",
		billingPeriodEnd: "2026-08-30T04:51:01.146719+00:00",
	},
})

const grokSettingsResponse = (): unknown => ({
	subscription_tier_display: "SuperGrok",
	default_model: "grok-4.6",
})

const mockGrokFetch = (billing: unknown, settings: unknown = grokSettingsResponse()) => {
	return vi.fn(async (url: string) => {
		const href = String(url)
		if (href.includes("/billing")) return jsonResponse(billing)
		if (href.includes("/settings")) return jsonResponse(settings)
		return new Response("not found", { status: 404 })
	})
}

const grokAuthRecord = (home: string) => ({
	path: path.join(home, ".pi", "agent", "auth.json"),
	accessToken: "xai-access-token-value",
	refreshToken: "xai-refresh-token-value",
})

describe("fetchGrokUsage", () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("parses weekly credits windows and SuperGrok plan label", async () => {
		vi.stubGlobal("fetch", mockGrokFetch(weeklyCreditsResponse()))

		const usage = await fetchGrokUsage(grokAuthRecord("/tmp"))

		expect(usage.percent).toBe(43)
		expect(usage.resetAtMs).toBe(Date.parse("2026-08-30T04:51:01.146719+00:00"))
		expect(usage.windowSeconds).toBe(7 * 24 * 60 * 60)
		expect(usage.level).toBe("SuperGrok")
	})

	it("treats a missing creditUsagePercent as 0% when a period exists", async () => {
		vi.stubGlobal("fetch", mockGrokFetch(omittedPercentCreditsResponse()))

		const usage = await fetchGrokUsage(grokAuthRecord("/tmp"))

		expect(usage.percent).toBe(0)
		expect(usage.resetAtMs).toBe(Date.parse("2026-08-30T04:51:01.146719+00:00"))
		expect(usage.windowSeconds).toBe(7 * 24 * 60 * 60)
	})

	it("falls back to used/monthlyLimit when the new period fields are absent", async () => {
		vi.stubGlobal(
			"fetch",
			mockGrokFetch({
				config: {
					used: { val: 4277 },
					monthlyLimit: { val: 60000 },
					billingPeriodEnd: "2026-06-01T00:00:00+00:00",
					billingPeriodStart: "2026-05-01T00:00:00+00:00",
				},
			}),
		)

		const usage = await fetchGrokUsage(grokAuthRecord("/tmp"))

		expect(usage.percent).toBe(7)
		expect(usage.resetAtMs).toBe(Date.parse("2026-06-01T00:00:00+00:00"))
		expect(usage.windowSeconds).toBe(31 * 24 * 60 * 60)
	})

	it("sends bearer auth, CLI token-auth, and a browser user-agent", async () => {
		const fetchMock = mockGrokFetch(weeklyCreditsResponse())
		vi.stubGlobal("fetch", fetchMock)

		await fetchGrokUsage(grokAuthRecord("/tmp"))

		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
		expect(url).toBe("https://cli-chat-proxy.grok.com/v1/billing?format=credits")
		const headers = init.headers as Record<string, string>
		expect(headers.Authorization).toBe("Bearer xai-access-token-value")
		expect(headers["X-XAI-Token-Auth"]).toBe("xai-grok-cli")
		expect(headers["User-Agent"]).toContain("Mozilla/5.0")
	})

	it("refreshes on 401 and retries billing", async () => {
		const fetchMock = vi.fn(async (url: string) => {
			const href = String(url)
			if (href.includes("oauth2/token")) {
				return jsonResponse({ access_token: "rotated-access-token", expires_in: 3600 })
			}
			if (href.includes("/billing")) {
				const auth = String(
					(fetchMock.mock.calls.at(-1)?.[1] as RequestInit | undefined)?.headers &&
						((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).headers as Record<string, string>)
							.Authorization,
				)
				if (auth.includes("rotated-access-token")) return jsonResponse(weeklyCreditsResponse())
				return new Response("expired", { status: 401 })
			}
			if (href.includes("/settings")) return jsonResponse(grokSettingsResponse())
			return new Response("not found", { status: 404 })
		})
		vi.stubGlobal("fetch", fetchMock)

		const usage = await fetchGrokUsage(grokAuthRecord("/tmp"))
		expect(usage.percent).toBe(43)
		expect(
			fetchMock.mock.calls.some(([url]) => String(url).includes("oauth2/token")),
		).toBe(true)
	})

	it("throws when config is missing", async () => {
		vi.stubGlobal("fetch", mockGrokFetch({}))

		await expect(fetchGrokUsage(grokAuthRecord("/tmp"))).rejects.toThrow(
			"grok usage response missing config",
		)
	})

	it("throws when no period or percent can be derived", async () => {
		vi.stubGlobal("fetch", mockGrokFetch({ config: { onDemandCap: { val: 0 } } }))

		await expect(fetchGrokUsage(grokAuthRecord("/tmp"))).rejects.toThrow(
			"grok usage response missing quota windows",
		)
	})
})

describe("parseGrokUsage", () => {
	it("labels a monthly period from the typed currentPeriod", () => {
		const usage = parseGrokUsage(
			{
				config: {
					creditUsagePercent: 10,
					currentPeriod: {
						type: "USAGE_PERIOD_TYPE_MONTHLY",
						start: "2026-08-01T00:00:00Z",
						end: "2026-09-01T00:00:00Z",
					},
				},
			},
			{ subscription_tier_display: "SuperGrok Heavy" },
		)

		expect(usage.percent).toBe(10)
		expect(usage.level).toBe("SuperGrok Heavy")
		expect(usage.windowSeconds).toBe(31 * 24 * 60 * 60)
	})
})

describe("resolveXaiAuth", () => {
	beforeEach(async () => {
		homeDir = await mkdtemp(testRootPrefix)
		await mkdir(path.join(homeDir, ".pi", "agent"), { recursive: true })
		process.env["HOME"] = homeDir
	})

	afterEach(async () => {
		vi.unstubAllEnvs()
		delete process.env["HOME"]
		delete process.env["GROK_HOME"]
		await rm(homeDir, { recursive: true, force: true })
	})

	it("reads the xai OAuth entry from pi's auth.json", async () => {
		await writeFile(
			path.join(homeDir, ".pi", "agent", "auth.json"),
			JSON.stringify({
				xai: {
					type: "oauth",
					access: "pi-xai-access-token",
					refresh: "pi-xai-refresh-token",
					expires: 1787482117501,
				},
			}),
			"utf-8",
		)

		expect(await resolveXaiAuth()).toEqual({
			path: path.join(homeDir, ".pi", "agent", "auth.json"),
			accessToken: "pi-xai-access-token",
			refreshToken: "pi-xai-refresh-token",
			expires: 1787482117501,
		})
	})

	it("ignores an xai API key and falls back to the Grok CLI auth file", async () => {
		await writeFile(
			path.join(homeDir, ".pi", "agent", "auth.json"),
			JSON.stringify({ xai: { type: "api_key", key: "xai-api-key-value" } }),
			"utf-8",
		)
		const grokHome = path.join(homeDir, "grok-home")
		await mkdir(grokHome, { recursive: true })
		await writeFile(
			path.join(grokHome, "auth.json"),
			JSON.stringify({
				"https://auth.x.ai::oidc": {
					key: "grok-cli-access-token",
					refresh_token: "grok-cli-refresh-token",
					expires_at: 1787482117501,
				},
			}),
			"utf-8",
		)
		vi.stubEnv("GROK_HOME", grokHome)

		expect(await resolveXaiAuth()).toEqual({
			path: path.join(grokHome, "auth.json"),
			accessToken: "grok-cli-access-token",
			refreshToken: "grok-cli-refresh-token",
			expires: 1787482117501,
		})
	})

	it("returns null when no subscription auth is configured", async () => {
		expect(await resolveXaiAuth()).toBeNull()
	})
})
