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

const { fetchZaiUsage, resolveZaiKey } = __usageStatusInternals

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
