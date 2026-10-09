/**
 * Tests for the self-compact pi extension
 * (chezmoi/private_dot_pi/private_agent/extensions/self-compact.ts →
 * ~/.pi/agent/extensions/self-compact.ts).
 *
 * Handlers and the tool are driven through a fake ExtensionAPI, and
 * ctx.compact records its options so a test settles the compaction itself.
 */

import { describe, it, expect } from "vitest"
import selfCompactExtension from "../../../chezmoi/private_dot_pi/private_agent/extensions/self-compact.ts"

const TOOL = "mcp__self-compact__compact"

type Handler = (event: any, ctx: any) => unknown
type Tool = { name: string; execute: (...args: any[]) => Promise<any> }
type CompactOptions = { customInstructions?: string; onComplete?: (result: unknown) => void; onError?: (error: Error) => void }

const createHarness = () => {
  const handlers = new Map<string, Handler>()
  const tools = new Map<string, Tool>()
  const sent: string[] = []
  const compactions: CompactOptions[] = []
  const pi = {
    on: (name: string, handler: Handler) => handlers.set(name, handler),
    registerTool: (tool: Tool) => tools.set(tool.name, tool),
    sendUserMessage: (content: string) => sent.push(content),
  }
  selfCompactExtension(pi as never)

  const ctx = (mode = "tui") => ({ mode, compact: (options: CompactOptions) => compactions.push(options) })
  const callTool = async (params: Record<string, unknown>, mode?: string) =>
    tools.get(TOOL)!.execute("call_1", params, undefined, undefined, ctx(mode))
  const settle = async () => handlers.get("agent_settled")?.({ type: "agent_settled" }, ctx())

  return { tools, sent, compactions, callTool, settle }
}

describe("self-compact pi extension", () => {
  it("registers the tool under the same name as the Claude Code plugin", () => {
    const { tools } = createHarness()
    expect([...tools.keys()]).toEqual([TOOL])
  })

  it("compacts after the run settles, then resumes with the given prompt", async () => {
    const { sent, compactions, callTool, settle } = createHarness()
    const result = await callTool({ instructions: "keep the plan", resume: "continue the task" })
    expect(result).toMatchObject({ terminate: true })
    expect(compactions).toEqual([])

    await settle()
    expect(compactions).toHaveLength(1)
    expect(compactions[0]?.customInstructions).toBe("keep the plan")

    compactions[0]?.onComplete?.({})
    expect(sent).toEqual(["continue the task"])
  })

  it("resumes with the failure reason when the compaction fails", async () => {
    const { sent, compactions, callTool, settle } = createHarness()
    await callTool({ resume: "continue the task" })
    await settle()
    expect(compactions[0]?.customInstructions).toBeUndefined()

    compactions[0]?.onError?.(new Error("Nothing to compact (session too small)"))
    expect(sent).toEqual(["The context compaction failed: Nothing to compact (session too small)\n\ncontinue the task"])
  })

  it("does nothing when the run settles without a request", async () => {
    const { sent, compactions, settle } = createHarness()
    await settle()
    expect(compactions).toEqual([])
    expect(sent).toEqual([])
  })

  it("compacts only once per request", async () => {
    const { compactions, callTool, settle } = createHarness()
    await callTool({ resume: "continue the task" })
    await settle()
    await settle()
    expect(compactions).toHaveLength(1)
  })

  it("refuses a request without resume", async () => {
    const { compactions, callTool, settle } = createHarness()
    const result = await callTool({ resume: "  " })
    expect(result.content[0].text).toMatch(/^Not scheduled/)
    expect(result.terminate).toBeUndefined()
    await settle()
    expect(compactions).toEqual([])
  })

  it.each(["print", "json"])("refuses a request in %s mode, where no next turn can follow", async (mode) => {
    const { compactions, callTool, settle } = createHarness()
    const result = await callTool({ resume: "continue the task" }, mode)
    expect(result.content[0].text).toMatch(/^Not scheduled/)
    await settle()
    expect(compactions).toEqual([])
  })
})
