/**
 * Tests for the language-guard pi extension
 * (chezmoi/private_dot_pi/private_agent/extensions/language-guard/index.ts →
 * ~/.pi/agent/extensions/language-guard/index.ts).
 *
 * In the chezmoi source, the extension's ./detect.mts is a symlink_ entry
 * pointing at the Claude Code hook's core, so the test injects that core.
 * Handlers are driven through a fake ExtensionAPI.
 */

import { describe, it, expect } from "vitest"
import * as core from "../../../chezmoi/dot_claude/hooks/language-guard/detect.mts"
import { createLanguageGuard } from "../../../chezmoi/private_dot_pi/private_agent/extensions/language-guard/index.ts"

const languageGuardExtension = createLanguageGuard(core)

const ENGLISH = "I have updated the configuration file and verified that every test passes."
const JAPANESE = "設定ファイルを更新し、すべてのテストが通ることを確認しました。"

type Handler = (event: any, ctx: any) => unknown

const createHarness = (mode = "tui") => {
  const handlers = new Map<string, Handler>()
  const pi = { on: (name: string, handler: Handler) => handlers.set(name, handler) }
  languageGuardExtension(pi as never)
  const ctx = { mode }
  const call = (name: string, event: unknown) => handlers.get(name)?.(event, ctx)

  const assistant = (text: string, withToolCall: boolean) => ({
    role: "assistant",
    stopReason: withToolCall ? "toolUse" : "stop",
    content: [
      { type: "thinking", thinking: "Reasoning in English or 中文 is fine." },
      { type: "text", text },
      ...(withToolCall ? [{ type: "toolCall", id: "call_1", name: "bash", arguments: {} }] : []),
    ],
  })
  const turnEnd = (text: string, withToolCall = false) =>
    call("turn_end", {
      type: "turn_end",
      message: assistant(text, withToolCall),
      entries: [{ type: "custom", customType: "other-extension" }],
      continue: false,
      outcome: "completed",
      // 最終応答直後の turn_end では、追加する entry を含まない preview なので常に false
      context: { canContinue: false },
    }) as { entries?: Array<Record<string, unknown>>; continue?: boolean } | undefined

  return { call, turnEnd }
}

describe("language-guard pi extension", () => {
  it("adds a hidden Japanese reminder before each agent run", () => {
    const { call } = createHarness()
    const result = call("before_agent_start", { type: "before_agent_start", prompt: "直して" })
    expect(result).toMatchObject({ message: { customType: "language-guard", display: false } })
  })

  it("requests one Japanese rewrite of an English final response", () => {
    const { call, turnEnd } = createHarness()
    call("input", { type: "input", text: "直して", source: "interactive" })
    const result = turnEnd(ENGLISH)
    expect(result?.continue).toBe(true)
    expect(result?.entries).toEqual([
      { type: "custom", customType: "other-extension" },
      expect.objectContaining({ type: "custom_message", customType: "language-guard", display: true }),
    ])
  })

  it("does not loop: the rewrite itself is not rewritten again", () => {
    const { turnEnd } = createHarness()
    expect(turnEnd(ENGLISH)?.continue).toBe(true)
    expect(turnEnd(ENGLISH)).toBeUndefined()
    // 次のドリフトでは再び書き直しを求める
    expect(turnEnd(ENGLISH)?.continue).toBe(true)
  })

  it("only nudges for drifted text accompanying a tool call", () => {
    const { turnEnd } = createHarness()
    const result = turnEnd(ENGLISH, true)
    expect(result?.continue).toBeUndefined()
    expect(result?.entries?.at(-1)).toMatchObject({ type: "custom_message", customType: "language-guard", display: false })
  })

  it("lets Japanese responses through", () => {
    const { turnEnd } = createHarness()
    expect(turnEnd(JAPANESE)).toBeUndefined()
  })

  it("respects an explicit request for another language", () => {
    const { call, turnEnd } = createHarness()
    call("input", { type: "input", text: "英語で書いて", source: "interactive" })
    expect(call("before_agent_start", { type: "before_agent_start", prompt: "英語で書いて" })).toBeUndefined()
    expect(turnEnd(ENGLISH)).toBeUndefined()
  })

  it("stays inactive in headless modes such as subagents", () => {
    const { call, turnEnd } = createHarness("json")
    expect(call("before_agent_start", { type: "before_agent_start", prompt: "直して" })).toBeUndefined()
    expect(turnEnd(ENGLISH)).toBeUndefined()
  })
})
