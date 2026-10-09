import { expect, test } from "claude-code/testing"

const TOOL = "mcp__self-compact__compact"
const COMPLETE = { turnId: "t1", answer: "", durationMs: 1, isAborted: false, reason: "answer" as const }

// The test runtime has timers, but the mods types declare no host globals
declare function setTimeout(callback: () => void, ms: number): unknown

// The compaction runs detached from the turn.complete hook, so let it settle
const settle = () => new Promise<void>((resolve) => setTimeout(() => resolve(), 10))

test("registers the compact tool when the session starts", async ($, on) => {
  const registered: string[] = []
  on("session.start", () => ({ cwd: "/work" }))
  on("tool.register", ($, e) => {
    registered.push(e.name)
    return { value: { tool: TOOL } }
  })

  await $.session.start({ surface: "terminal", isInteractive: true, cwd: "/work" })

  expect(registered).toEqual(["compact"])
})

test("compacts after the turn completes, then resumes", async ($, on) => {
  const events: string[] = []
  on("session.compact", ($, e) => {
    events.push("compact: " + e.instructions)
    return { messages: [{ role: "user", text: "summary", toolUses: [] }] }
  })
  on("prompt.submit", ($, e) => {
    events.push("submit: " + e.text)
    return { text: e.text }
  })
  on("turn.complete", () => ({ text: "" }))

  const call = await $.tool.call({ tool: TOOL, instructions: "keep the plan", resume: "continue step 3" })
  expect(events).toEqual([])
  expect(call.result).toContain("End your turn")

  await $.turn.complete(COMPLETE)
  await settle()

  expect(events).toEqual(["compact: keep the plan", "submit: continue step 3"])
})

test("tells Claude why when a hook skips the compaction", async ($, on) => {
  const submitted: string[] = []
  on("session.compact", () => ({ skip: "blocked by policy" }))
  on("prompt.submit", ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on("turn.complete", () => ({ text: "" }))

  await $.tool.call({ tool: TOOL, instructions: "keep the plan", resume: "continue step 3" })
  await $.turn.complete(COMPLETE)
  await settle()

  expect(submitted.length).toBe(1)
  expect(submitted[0]).toContain("blocked by policy")
  expect(submitted[0]).toContain("continue step 3")
})

test("does nothing at the end of a turn without a request", async ($, on) => {
  const compacted: unknown[] = []
  on("session.compact", ($, e) => {
    compacted.push(e)
    return { messages: [{ role: "user", text: "summary", toolUses: [] }] }
  })
  on("turn.complete", () => ({ text: "" }))

  await $.turn.complete(COMPLETE)
  await settle()

  expect(compacted).toEqual([])
})

test("rejects a call without resume text", async ($, on) => {
  const call = await $.tool.call({ tool: TOOL, instructions: "keep the plan" })

  expect(call.result).toContain("resume")
})

test("keeps the compact tool out of ToolSearch", async ($, on) => {
  on("tool.describe", ($, e) => ({ description: e.description, isDeferred: true as const }))

  const described = await $.tool.describe({ tool: TOOL, description: "compact", isDeferred: true, provider: { plugin: "self-compact", tier: "user" } })

  expect(described.isDeferred).toBe(false)
})

test("refuses a call from a subagent", async ($, on) => {
  const call = await $.tool.call({ tool: TOOL, agentId: "a1", resume: "continue step 3" })

  expect(call.result).toContain("main conversation")
})

test("waits for the main loop's turn when a subagent's turn completes first", async ($, on) => {
  const events: string[] = []
  on("session.compact", () => {
    events.push("compact")
    return { messages: [{ role: "user", text: "summary", toolUses: [] }] }
  })
  on("prompt.submit", ($, e) => {
    events.push("submit")
    return { text: e.text }
  })
  on("turn.complete", () => ({ text: "" }))

  await $.tool.call({ tool: TOOL, resume: "continue step 3" })
  await $.turn.complete({ ...COMPLETE, agentId: "a1" })
  await settle()
  expect(events).toEqual([])

  await $.turn.complete(COMPLETE)
  await settle()
  expect(events).toEqual(["compact", "submit"])
})
