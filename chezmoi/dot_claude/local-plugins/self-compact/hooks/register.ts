// Gives Claude a `compact` tool to compact its own context and keep working.
// $.session.compact() rejects while a turn runs, so the tool only records the
// request. The compaction runs once the turn completes, and a prompt carrying
// `resume` starts the next turn.
import type { On, SessionCompactArgs, SessionCompactResult } from "claude-code"

const TOOL = "mcp__self-compact__compact"

const DESCRIPTION = [
  "Compact your own conversation context to free space and keep working.",
  "The compaction runs right after this turn ends, so end your turn right after calling this tool.",
  "`resume` is then sent to you as the next prompt: put in it what you need to continue the task.",
].join(" ")

const INPUT_SCHEMA = {
  type: "object",
  properties: {
    instructions: { type: "string", description: "What the summary must keep or drop" },
    resume: { type: "string", description: "The prompt to continue with after the compaction" },
  },
  required: ["resume"],
}

type Request = { instructions: string | undefined; resume: string }

type Outcome =
  | { kind: "compacted" }
  | { kind: "skipped"; reason: string }
  | { kind: "failed"; reason: string }

type Compact = (args: Pick<SessionCompactArgs, "instructions">) => Promise<SessionCompactResult>

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim() !== ""

// Decides the prompt that starts the next turn from how the compaction ended
const followUp = (outcome: Outcome, resume: string): string => {
  switch (outcome.kind) {
    case "compacted":
      return resume
    case "skipped":
      return `The context was not compacted: ${outcome.reason}\n\n${resume}`
    case "failed":
      return `The context compaction failed: ${outcome.reason}\n\n${resume}`
  }
}

const compact = async (run: Compact, instructions: string | undefined): Promise<Outcome> => {
  try {
    const result = await run(instructions === undefined ? {} : { instructions })
    return result.skip === undefined ? { kind: "compacted" } : { kind: "skipped", reason: result.skip }
  } catch (error) {
    return { kind: "failed", reason: error instanceof Error ? error.message : String(error) }
  }
}

// The request recorded by the tool call, consumed when the main loop's turn completes
let pending: Request | null = null

export function register(on: On) {
  on("session.start", async ($, e, next) => {
    await $.tool.register({ name: "compact", description: DESCRIPTION, inputSchema: INPUT_SCHEMA })
    return next(e)
  })

  // An MCP-style tool waits behind ToolSearch by default; keep it in the prompt's list
  on("tool.describe", { tool: TOOL }, async ($, e, next) => ({ ...(await next(e)), isDeferred: false }))

  on("tool.call", { tool: TOOL }, async ($, e) => {
    // A subagent's context is not the session's, so only the main loop may compact
    if (e.agentId !== undefined) {
      return { result: "Not scheduled: only the main conversation can compact the session context." }
    }
    if (!isNonEmptyString(e.resume)) {
      return { result: "Not scheduled: pass `resume`, the prompt to continue with after the compaction." }
    }
    pending = { instructions: isNonEmptyString(e.instructions) ? e.instructions : undefined, resume: e.resume }
    return { result: "Compaction scheduled. End your turn now; `resume` starts the next turn after the compaction." }
  })

  on("turn.complete", async ($, e, next) => {
    const result = await next(e)
    // A subagent's turn also completes here; only the main loop's turn ends the request's turn
    if (e.agentId === undefined && pending !== null) {
      const request = pending
      pending = null
      // Detached: the compaction cannot start until this turn has finished
      void compact((args) => $.session.compact(args), request.instructions).then((outcome) =>
        $.prompt.submit({ text: followUp(outcome, request.resume) }),
      )
    }
    return result
  })
}
