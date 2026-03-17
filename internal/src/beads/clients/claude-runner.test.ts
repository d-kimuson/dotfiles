import { describe, it, expect, beforeEach } from "vitest";
import type { SessionInfo } from "../types.ts";
import { mockExec, mockExecFile, mockExecFileResolve, mockExecFileReject } from "../test-helpers.ts";
import { extractSessionId, runClaudeCode } from "./claude-runner.ts";

beforeEach(() => {
  mockExec.mockReset();
  mockExec.mockReturnValue("");
  mockExecFile.mockReset();
});

describe("extractSessionId", () => {
  it("extracts tool and session id from labels", () => {
    const result = extractSessionId(["implement", "session-id:claude:abc-123"]);
    expect(result).toEqual({ tool: "claude", sessionId: "abc-123" } satisfies SessionInfo);
  });

  it("returns undefined when no session label", () => {
    expect(extractSessionId(["implement"])).toBeUndefined();
  });

  it("returns undefined when label format is invalid", () => {
    expect(extractSessionId(["session-id:"])).toBeUndefined();
  });
});

describe("runClaudeCode", () => {
  it("creates new session and adds label after execution", async () => {
    mockExecFileResolve("");   // claude command (async)
    mockExec.mockReturnValueOnce("");  // bd update (add label, sync)

    const result = await runClaudeCode("do something", {
      issueId: "beads-test-abc",
      resume: undefined,
    });

    expect(result.sessionId).toBe("MOCK-UUID");

    // execFile call: claude command
    const execFileCalls = mockExecFile.mock.calls;
    expect(execFileCalls[0]?.[0]).toBe("claude");
    expect(execFileCalls[0]?.[1]).toEqual(expect.arrayContaining(["--session-id", "MOCK-UUID"]));
    // execFileSync call: bd update
    const syncCalls = mockExec.mock.calls;
    expect(syncCalls[0]?.[0]).toBe("bd");
    expect(syncCalls[0]?.[1]).toEqual(expect.arrayContaining(["update", "beads-test-abc", "--add-label", "session-id:claude:MOCK-UUID"]));
  });

  it("resumes existing session without adding label", async () => {
    mockExecFileResolve("");  // claude command (async)

    const result = await runClaudeCode("continue work", {
      issueId: "beads-test-abc",
      resume: "EXISTING-UUID",
    });

    expect(result.sessionId).toBe("EXISTING-UUID");
    const execFileCalls = mockExecFile.mock.calls;
    expect(execFileCalls[0]?.[0]).toBe("claude");
    expect(execFileCalls[0]?.[1]).toEqual(expect.arrayContaining(["--resume", "EXISTING-UUID"]));
    // Should NOT call bd update to add label
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("passes --system-prompt with empty string when disableClaudeCodeSystemPrompt is true", async () => {
    mockExecFileResolve("");      // claude command (async)
    mockExec.mockReturnValueOnce("");     // bd update

    await runClaudeCode("plan something", {
      issueId: "beads-test-abc",
      disableClaudeCodeSystemPrompt: true,
      resume: undefined,
    });

    const execFileCalls = mockExecFile.mock.calls;
    const claudeCall = execFileCalls.find((c) => c[0] === "claude");
    const args = claudeCall?.[1] as string[];
    expect(args).toEqual(expect.arrayContaining(["--system-prompt", ""]));
  });

  it("does not need single-quote escaping (execFile handles it)", async () => {
    mockExecFileResolve("");      // claude command (async)
    mockExec.mockReturnValueOnce("");     // bd update

    await runClaudeCode("it's a test", {
      issueId: "beads-test-abc",
      resume: undefined,
    });

    const execFileCalls = mockExecFile.mock.calls;
    const claudeCall = execFileCalls.find((c) => c[0] === "claude");
    const args = claudeCall?.[1] as string[];
    // Prompt is passed as-is, no escaping needed
    expect(args).toEqual(expect.arrayContaining(["-p", "it's a test"]));
  });

  it("passes --agent when specified", async () => {
    mockExecFileResolve("");      // claude command (async)
    mockExec.mockReturnValueOnce("");     // bd update

    await runClaudeCode("do work", {
      issueId: "beads-test-abc",
      agent: "architect",
      resume: undefined,
    });

    const execFileCalls = mockExecFile.mock.calls;
    const claudeCall = execFileCalls.find((c) => c[0] === "claude");
    const args = claudeCall?.[1] as string[];
    expect(args).toEqual(expect.arrayContaining(["--agent", "architect"]));
  });

  it("trims stdout from execFile result", async () => {
    mockExecFileResolve("  hello world  ");

    const result = await runClaudeCode("test", { resume: undefined });

    expect(result.stdout).toBe("hello world");
  });

  it("passes timeout option to execFile", async () => {
    mockExecFileResolve("");

    await runClaudeCode("test", { resume: undefined });

    const execFileCalls = mockExecFile.mock.calls;
    const opts = execFileCalls[0]?.[2] as { timeout?: number };
    expect(opts.timeout).toBe(1_800_000); // 30 minutes
  });

  it("rejects when execFile fails", async () => {
    mockExecFileReject("command failed");

    await expect(runClaudeCode("test", { resume: undefined })).rejects.toThrow("command failed");
  });

  it("rejects when execFile times out", async () => {
    mockExecFileReject("TIMEOUT");

    await expect(runClaudeCode("test", { resume: undefined })).rejects.toThrow("TIMEOUT");
  });
});
