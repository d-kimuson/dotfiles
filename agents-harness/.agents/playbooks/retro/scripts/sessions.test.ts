import assert from "node:assert/strict"
import { test } from "node:test"
import { normalize, parseSession } from "./sessions.ts"

const lines = (...records: unknown[]): string[] => records.map((r) => JSON.stringify(r))

test("normalize は差し込まれた文脈と委譲文を除き、slash command を戻す", () => {
  assert.equal(normalize("<system-reminder>x</system-reminder>"), undefined)
  assert.equal(normalize("You are working inside Orca, a multi-agent IDE."), undefined)
  assert.equal(normalize("<command-name>/retro</command-name><command-args>先週分</command-args>"), "/retro 先週分")
  assert.equal(normalize("  直して  "), "直して")
})

test("claude: tool_result・sidechain・compaction の要約・重複を除く", () => {
  const s = parseSession(
    "claude",
    "p",
    lines(
      { type: "user", cwd: "/w", timestamp: "t1", message: { content: "依頼" } },
      { type: "user", timestamp: "t2", message: { content: [{ type: "tool_result", content: "out" }] } },
      { type: "user", timestamp: "t3", isSidechain: true, message: { content: "sub" } },
      { type: "user", timestamp: "t4", message: { content: "依頼" } },
      { type: "user", timestamp: "t5", message: { content: "This session is being continued from a previous conversation ..." } },
    ),
  )
  assert.equal(s.cwd, "/w")
  assert.deepEqual(s.messages, [{ at: "t1", text: "依頼" }])
})

test("codex: response_item の user message を読む", () => {
  const s = parseSession(
    "codex",
    "p",
    lines(
      { type: "session_meta", payload: { cwd: "/w" } },
      { type: "response_item", timestamp: "t1", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "# AGENTS.md instructions\n..." }] } },
      { type: "response_item", timestamp: "t2", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "依頼" }] } },
    ),
  )
  assert.deepEqual(s.messages, [{ at: "t2", text: "依頼" }])
})

test("pi と commandcode: message の user role を読む", () => {
  const s = parseSession(
    "pi",
    "p",
    lines(
      { type: "session", cwd: "/w" },
      { type: "message", timestamp: "t1", message: { role: "user", content: [{ type: "text", text: "依頼" }] } },
      { type: "message", timestamp: "t2", message: { role: "assistant", content: [{ type: "text", text: "応答" }] } },
    ),
  )
  assert.equal(s.cwd, "/w")
  assert.deepEqual(s.messages, [{ at: "t1", text: "依頼" }])
})
