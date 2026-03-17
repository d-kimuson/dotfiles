import { describe, it, expect, beforeEach } from "vitest";
import { mockExec, mockExecFile, mockExecFileResolve, mockExecFileReject, makeIssue } from "../test-helpers.ts";
import { handleArchitectReview, handlePlan, handleImplement } from "./handlers.ts";

beforeEach(() => {
  mockExec.mockReset();
  mockExec.mockReturnValue("");
  mockExecFile.mockReset();
});

describe("handleArchitectReview", () => {
  it("runs architect then pdm and returns separate stdouts", async () => {
    mockExecFileResolve("architect says: refactor module X");  // claude --agent bd-architect (async)
    mockExecFileResolve("pdm says: created beads-xyz");       // claude --agent bd-pdm (async)
    mockExec
      .mockReturnValueOnce("")   // git diff docs/
      .mockReturnValueOnce("");  // git ls-files docs/

    const result = await handleArchitectReview();

    expect(result).toEqual({
      kind: "architect-review",
      architectStdout: "architect says: refactor module X",
      pdmStdout: "pdm says: created beads-xyz",
    });
  });

  it("calls claude with bd-architect agent first", async () => {
    mockExecFileResolve("");  // architect
    mockExecFileResolve("");  // pdm
    mockExec
      .mockReturnValueOnce("")   // git diff docs/
      .mockReturnValueOnce("");  // git ls-files docs/

    await handleArchitectReview();

    const calls = mockExecFile.mock.calls;
    expect(calls[0]?.[0]).toBe("claude");
    const args = calls[0]?.[1] as string[];
    expect(args).toEqual(expect.arrayContaining(["--agent", "bd-architect"]));
  });

  it("calls claude with bd-pdm agent second, including architect output", async () => {
    mockExecFileResolve("review findings here");  // architect
    mockExecFileResolve("");                       // pdm
    mockExec
      .mockReturnValueOnce("")   // git diff docs/
      .mockReturnValueOnce("");  // git ls-files docs/

    await handleArchitectReview();

    const calls = mockExecFile.mock.calls;
    expect(calls[1]?.[0]).toBe("claude");
    const args = calls[1]?.[1] as string[];
    expect(args).toEqual(expect.arrayContaining(["--agent", "bd-pdm"]));
    const prompt = args[args.indexOf("-p") + 1];
    expect(prompt).toContain("Architect Output:");
    expect(prompt).toContain("review findings here");
  });

  it("does not add session labels (no issueId)", async () => {
    mockExecFileResolve("");  // claude (architect)
    mockExecFileResolve("");  // claude (pdm)
    mockExec
      .mockReturnValueOnce("")   // git diff docs/
      .mockReturnValueOnce("");  // git ls-files docs/

    await handleArchitectReview();

    // sync calls: commitDocsIfDirty (diff + ls-files). No bd update calls.
    const syncCalls = mockExec.mock.calls;
    expect(syncCalls.filter((c) => c[0] === "bd")).toHaveLength(0);
  });
});

describe("handlePlan", () => {
  it("rolls back status to open when runClaudeCode fails", async () => {
    const issue = makeIssue({ id: "beads-test-p1", labels: ["step:plan"] });
    mockExec.mockReturnValue(""); // bd update (in_progress)
    mockExecFileReject("claude crashed");

    await expect(handlePlan(issue)).rejects.toThrow("claude crashed");

    const bdCalls = mockExec.mock.calls.filter((c) => c[0] === "bd");
    // 1st: status in_progress, 2nd: status open (rollback)
    expect(bdCalls).toHaveLength(2);
    expect(bdCalls[0]?.[1]).toEqual(
      expect.arrayContaining(["--status", "in_progress"]),
    );
    expect(bdCalls[1]?.[1]).toEqual(
      expect.arrayContaining(["--status", "open"]),
    );
  });
});

describe("handleImplement", () => {
  it("rolls back status to open when runClaudeCode fails (new branch)", async () => {
    const issue = makeIssue({ id: "beads-test-i1", labels: ["step:implement"] });
    mockExec.mockReturnValue(""); // all sync calls succeed
    mockExecFileReject("claude crashed");

    await expect(handleImplement(issue)).rejects.toThrow("claude crashed");

    const bdCalls = mockExec.mock.calls.filter((c) => c[0] === "bd");
    // 1st: status in_progress, 2nd: addLabels branch, 3rd: status open (rollback)
    expect(bdCalls).toHaveLength(3);
    expect(bdCalls[0]?.[1]).toEqual(
      expect.arrayContaining(["--status", "in_progress"]),
    );
    expect(bdCalls[2]?.[1]).toEqual(
      expect.arrayContaining(["--status", "open"]),
    );
  });

  it("rolls back status to open when git switch fails (existing branch)", async () => {
    const issue = makeIssue({
      id: "beads-test-i2",
      labels: ["step:implement", "branch:beads/tasks/beads-test-i2"],
    });
    mockExec.mockImplementation(((cmd: string, args: readonly string[]) => {
      if (cmd === "git" && args[0] === "switch") {
        throw new Error("git switch failed");
      }
      return "";
    }) as typeof import("node:child_process").execFileSync);

    await expect(handleImplement(issue)).rejects.toThrow("git switch failed");
  });
});
