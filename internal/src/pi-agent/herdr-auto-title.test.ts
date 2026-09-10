/**
 * Tests for the herdr-auto-title pi extension's gating and hook forwarding.
 *
 * The extension lives outside internal/ (it is distributed to
 * ~/.pi/agent/extensions/), but its testable internals are exported via
 * __herdrAutoTitleInternals. Generation, socket IPC, and state live in the
 * vendored Python script and are covered there; these tests cover the thin
 * forwarding layer: when an input event should spawn the script and what
 * hook payload it carries.
 */

import { describe, it, expect, afterEach } from "vitest"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { __herdrAutoTitleInternals } from "../../../chezmoi/private_dot_pi/private_agent/extensions/herdr-auto-title.ts"

const { isHerdrPane, resolveScript, buildHookInput, shouldHandle } = __herdrAutoTitleInternals

const HERDR_ENV_KEYS = [
	"HERDR_ENV",
	"HERDR_SOCKET_PATH",
	"HERDR_PANE_ID",
	"HERDR_TAB_ID",
	"HERDR_WORKSPACE_ID",
	"HERDR_AUTO_TITLE_DISABLE",
] as const

const savedEnv: Record<string, string | undefined> = {}

const setHerdrEnv = (overrides: Record<string, string | undefined> = {}): void => {
	for (const key of HERDR_ENV_KEYS) {
		savedEnv[key] = process.env[key]
		delete process.env[key]
	}
	const base: Record<string, string> = {
		HERDR_ENV: "1",
		HERDR_SOCKET_PATH: "/tmp/herdr.sock",
		HERDR_PANE_ID: "w9:p3",
	}
	for (const [key, value] of Object.entries({ ...base, ...overrides })) {
		if (value === undefined) delete process.env[key]
		else process.env[key] = value
	}
}

afterEach(() => {
	for (const key of HERDR_ENV_KEYS) {
		const saved = savedEnv[key]
		if (saved === undefined) delete process.env[key]
		else process.env[key] = saved
	}
})

const herdrEnv = {
	HERDR_ENV: "1",
	HERDR_SOCKET_PATH: "/tmp/herdr.sock",
	HERDR_PANE_ID: "w9:p3",
}

describe("isHerdrPane", () => {
	it("accepts a complete herdr pane environment", () => {
		expect(isHerdrPane({ ...herdrEnv })).toBe(true)
	})

	it("accepts tab id when pane id is absent", () => {
		expect(isHerdrPane({ HERDR_ENV: "1", HERDR_SOCKET_PATH: "/tmp/x.sock", HERDR_TAB_ID: "w1:t1" })).toBe(
			true,
		)
	})

	it("rejects missing socket path or pane/tab ids", () => {
		expect(isHerdrPane({ ...herdrEnv, HERDR_SOCKET_PATH: "" })).toBe(false)
		expect(isHerdrPane({ HERDR_ENV: "1", HERDR_SOCKET_PATH: "/tmp/x.sock" })).toBe(false)
		expect(isHerdrPane({})).toBe(false)
	})

	it("rejects when the kill switch is set", () => {
		expect(isHerdrPane({ ...herdrEnv, HERDR_AUTO_TITLE_DISABLE: "1" })).toBe(false)
	})
})

describe("resolveScript", () => {
	it("finds the vendored hook script under the home directory", async () => {
		const home = await mkdtemp(path.join(tmpdir(), "herdr-title-home-"))
		try {
			await mkdir(path.join(home, ".claude", "hooks"), { recursive: true })
			await writeFile(path.join(home, ".claude", "hooks", "herdr-auto-title.py"), "#!/usr/bin/env python3\n")
			expect(resolveScript(home)).toBe(path.join(home, ".claude", "hooks", "herdr-auto-title.py"))
		} finally {
			await rm(home, { recursive: true, force: true })
		}
	})

	it("returns undefined when the script is not installed", async () => {
		const home = await mkdtemp(path.join(tmpdir(), "herdr-title-empty-"))
		try {
			expect(resolveScript(home)).toBeUndefined()
		} finally {
			await rm(home, { recursive: true, force: true })
		}
	})
})

const mockCtx = (overrides: Record<string, unknown> = {}): any => ({
	mode: "tui",
	cwd: "/tmp",
	sessionManager: {
		getSessionId: () => "session-123",
		getSessionFile: () => "/tmp/session.jsonl",
	},
	...overrides,
})

describe("buildHookInput", () => {
	it("carries the pi agent marker with session references and raw prompt", () => {
		expect(buildHookInput(mockCtx(), "ログイン画面を修正して")).toEqual({
			session_id: "session-123",
			transcript_path: "/tmp/session.jsonl",
			prompt: "ログイン画面を修正して",
			agent: "pi",
		})
	})

	it("falls back when session metadata is unavailable", () => {
		const ctx = mockCtx({
			sessionManager: {
				getSessionId: () => {
					throw new Error("no session")
				},
				getSessionFile: () => undefined,
			},
		})
		expect(buildHookInput(ctx, "hi")).toEqual({
			session_id: "unknown",
			transcript_path: undefined,
			prompt: "hi",
			agent: "pi",
		})
	})
})

describe("shouldHandle", () => {
	it("handles interactive TUI input inside a herdr pane", () => {
		setHerdrEnv()
		expect(shouldHandle(mockCtx(), { text: "何かして", source: "interactive" })).toBe(true)
	})

	it("ignores headless modes", () => {
		setHerdrEnv()
		for (const mode of ["rpc", "json", "print"]) {
			expect(shouldHandle(mockCtx({ mode }), { text: "何かして", source: "interactive" })).toBe(false)
		}
	})

	it("ignores non-interactive sources and blank prompts", () => {
		setHerdrEnv()
		expect(shouldHandle(mockCtx(), { text: "何かして", source: "extension" })).toBe(false)
		expect(shouldHandle(mockCtx(), { text: "何かして", source: "rpc" })).toBe(false)
		expect(shouldHandle(mockCtx(), { text: "   ", source: "interactive" })).toBe(false)
	})

	it("ignores input outside herdr", () => {
		setHerdrEnv({ HERDR_ENV: undefined })
		expect(shouldHandle(mockCtx(), { text: "何かして", source: "interactive" })).toBe(false)
	})
})
