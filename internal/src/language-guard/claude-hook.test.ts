/**
 * Integration tests for the language-guard Claude Code hook
 * (chezmoi/dot_claude/hooks/language-guard/executable_hook.mts →
 * ~/.claude/hooks/language-guard/hook.mts).
 *
 * The hook is executed as a real process with hook JSON on stdin, the same
 * way Claude Code runs it, against a temporary transcript.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { execFileSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const HOOK = path.resolve(import.meta.dirname, "../../../chezmoi/dot_claude/hooks/language-guard/executable_hook.mts")

const ENGLISH = "I have updated the configuration file and verified that every test passes."
const JAPANESE = "設定ファイルを更新し、すべてのテストが通ることを確認しました。"

type Entry = Record<string, unknown>

const userPrompt = (text: string): Entry => ({ type: "user", message: { role: "user", content: text } })
const assistantBlock = (id: string, block: Entry): Entry => ({
  type: "assistant",
  message: { id, role: "assistant", content: [block] },
})
const toolResult = (toolUseId: string): Entry => ({
  type: "user",
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: toolUseId, content: "ok" }] },
})

let dir = ""
let transcript = ""

const writeTranscript = async (entries: readonly Entry[]): Promise<void> => {
  await writeFile(transcript, entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n")
}

const runHook = (input: Entry): unknown => {
  const stdout = execFileSync("node", [HOOK], {
    input: JSON.stringify({ session_id: "s1", transcript_path: transcript, cwd: dir, ...input }),
    encoding: "utf8",
  })
  return stdout.trim() === "" ? undefined : JSON.parse(stdout)
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "language-guard-hook-"))
  transcript = path.join(dir, "transcript.jsonl")
  await writeTranscript([userPrompt("hook を直して")])
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe("UserPromptSubmit", () => {
  it("adds the Japanese reminder as additional context", () => {
    const output = runHook({ hook_event_name: "UserPromptSubmit", prompt: "hook を直して" })
    expect(output).toMatchObject({
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: expect.stringContaining("Japanese") },
    })
  })

  it("stays silent when the user asks for another language", () => {
    expect(runHook({ hook_event_name: "UserPromptSubmit", prompt: "英語で書いて" })).toBeUndefined()
  })
})

describe("Stop", () => {
  it("blocks once and asks for a Japanese rewrite of an English final response", () => {
    const output = runHook({ hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: ENGLISH })
    expect(output).toMatchObject({ decision: "block", reason: expect.stringContaining("日本語で書き直してください") })
  })

  it("does not block again while a stop hook continuation is active", () => {
    expect(runHook({ hook_event_name: "Stop", stop_hook_active: true, last_assistant_message: ENGLISH })).toBeUndefined()
  })

  it("lets a Japanese final response through", () => {
    expect(runHook({ hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: JAPANESE })).toBeUndefined()
  })

  it("falls back to the transcript when last_assistant_message is missing", async () => {
    await writeTranscript([userPrompt("hook を直して"), assistantBlock("msg_1", { type: "text", text: ENGLISH })])
    expect(runHook({ hook_event_name: "Stop", stop_hook_active: false })).toMatchObject({ decision: "block" })
  })

  it("respects an explicit request for another language in the last user prompt", async () => {
    await writeTranscript([userPrompt("この文章を英訳して"), toolResult("toolu_0")])
    expect(runHook({ hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: ENGLISH })).toBeUndefined()
  })
})

describe("PostToolUse", () => {
  beforeEach(async () => {
    await writeTranscript([
      userPrompt("hook を直して"),
      assistantBlock("msg_1", { type: "thinking", thinking: "Let me think about this in English, which is fine." }),
      assistantBlock("msg_1", { type: "text", text: ENGLISH }),
      assistantBlock("msg_1", { type: "tool_use", id: "toolu_1", name: "Bash", input: {} }),
      assistantBlock("msg_1", { type: "tool_use", id: "toolu_2", name: "Bash", input: {} }),
    ])
  })

  it("nudges after the first tool call of a message whose text drifted", () => {
    const output = runHook({ hook_event_name: "PostToolUse", tool_use_id: "toolu_1" })
    expect(output).toMatchObject({
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: expect.stringContaining("[language-guard]") },
    })
  })

  it("does not repeat the nudge for parallel tool calls of the same message", () => {
    expect(runHook({ hook_event_name: "PostToolUse", tool_use_id: "toolu_2" })).toBeUndefined()
  })

  it("ignores thinking-only messages", async () => {
    await writeTranscript([
      userPrompt("hook を直して"),
      assistantBlock("msg_2", { type: "thinking", thinking: "This reasoning is entirely in English and that is allowed." }),
      assistantBlock("msg_2", { type: "tool_use", id: "toolu_3", name: "Bash", input: {} }),
    ])
    expect(runHook({ hook_event_name: "PostToolUse", tool_use_id: "toolu_3" })).toBeUndefined()
  })
})
