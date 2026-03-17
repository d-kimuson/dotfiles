import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockExec, mockExecFile, mockExecFileResolve, mockExecFileReject, makeIssue } from "./test-helpers.ts";
import { tick, loop, shutdownState } from "./loop.ts";

beforeEach(() => {
  mockExec.mockReset();
  mockExec.mockReturnValue("");
  mockExecFile.mockReset();
});

// ---------------------------------------------------------------------------
// mergeVerdict warning
// ---------------------------------------------------------------------------

describe("mergeVerdict warning", () => {
  const mockWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    mockWarn.mockClear();
  });

  it("warns when needs:feature-review is on non-feature type", async () => {
    const issue = makeIssue({ type: "task", labels: ["needs:feature-review"] });

    mockExec.mockReset();
    mockExecFile.mockReset();
    mockExec.mockReturnValue("");
    mockExec
      .mockReturnValueOnce("[]") // bd ready (plan)
      .mockReturnValueOnce(JSON.stringify([issue])) // bd ready (implement)
      .mockReturnValueOnce("") // bd update (in_progress + assignee)
      .mockReturnValueOnce("") // git switch -c
      .mockReturnValueOnce(""); // bd update (branch label)
    mockExecFileResolve(""); // claude command (async)
    // After claude: bd update (session label), git status, bd show, git switch main
    mockExec
      .mockReturnValueOnce("") // bd update (session label)
      .mockReturnValueOnce("") // git status (clean)
      .mockReturnValueOnce(JSON.stringify([issue])) // bd show (mergeVerdict)
      .mockReturnValueOnce(""); // git switch main

    await tick({ tickCount: 1 });

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('feature 以外の type "task"'),
    );
  });

  it("does not warn when needs:feature-review is on feature type", async () => {
    const issue = makeIssue({ type: "feature", labels: ["needs:feature-review"] });
    mockExec
      .mockReturnValueOnce("[]") // bd ready (plan)
      .mockReturnValueOnce(JSON.stringify([issue])) // bd ready (implement)
      .mockReturnValueOnce("") // bd update (in_progress + assignee)
      .mockReturnValueOnce("") // git switch -c
      .mockReturnValueOnce(""); // bd update (branch label)
    mockExecFileResolve(""); // claude command (async)
    mockExec
      .mockReturnValueOnce("") // bd update (session label)
      .mockReturnValueOnce("") // git status (clean)
      .mockReturnValueOnce(JSON.stringify([issue])) // bd show (mergeVerdict)
      .mockReturnValueOnce(""); // git switch main

    await tick({ tickCount: 1 });

    expect(mockWarn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// tick
// ---------------------------------------------------------------------------

describe("tick", () => {
  it("returns idle when no ready issues", async () => {
    mockExec
      .mockReturnValueOnce("[]")   // bd ready --json (plan)
      .mockReturnValueOnce("[]");  // bd ready --json (implement)

    expect(await tick({ tickCount: 1 })).toEqual({ kind: "idle" });
  });

  it("prioritizes plan over implement", async () => {
    const planIssue = makeIssue({ id: "beads-test-p1", labels: ["step:plan"] });

    mockExec
      // bd ready --json (plan)
      .mockReturnValueOnce(JSON.stringify([planIssue]))
      // bd update (in_progress)
      .mockReturnValueOnce("");
    mockExecFileResolve(""); // claude command (async)
    mockExec.mockReturnValueOnce(""); // bd update (add session label)

    // validatePostPlan: bd show
    mockExec.mockReturnValueOnce(JSON.stringify([planIssue]));

    expect(await tick({ tickCount: 1 })).toEqual({ kind: "planned", issueId: "beads-test-p1", stdout: "" });
  });

  it("handles implement: new session → merge", async () => {
    const issue = makeIssue({ labels: ["step:implement"] });

    mockExec
      // bd ready --json (plan) → empty
      .mockReturnValueOnce("[]")
      // bd ready --json (implement)
      .mockReturnValueOnce(JSON.stringify([issue]))
      // bd update (in_progress)
      .mockReturnValueOnce("")
      // git switch -c
      .mockReturnValueOnce("")
      // bd update (branch label)
      .mockReturnValueOnce("");
    mockExecFileResolve(""); // claude command (async)
    mockExec
      // bd update (add session label)
      .mockReturnValueOnce("")
      // git status --porcelain (clean)
      .mockReturnValueOnce("")
      // bd show --json (merge verdict)
      .mockReturnValueOnce(JSON.stringify([issue]))
      // git switch main
      .mockReturnValueOnce("")
      // git merge
      .mockReturnValueOnce("")
      // bd close
      .mockReturnValueOnce("")
      // git branch -d
      .mockReturnValueOnce("");

    expect(await tick({ tickCount: 1 })).toEqual({ kind: "merged", issueId: "beads-test-abc", stdout: "" });
  });

  it("handles implement: resume existing session", async () => {
    const issue = makeIssue({
      labels: ["step:implement", "session-id:claude:PREV-UUID", "branch:beads/tasks/beads-test-abc"],
    });

    mockExec
      // bd ready --json (plan) → empty
      .mockReturnValueOnce("[]")
      // bd ready --json (implement)
      .mockReturnValueOnce(JSON.stringify([issue]))
      // git switch (existing branch)
      .mockReturnValueOnce("");
    mockExecFileResolve(""); // claude --resume (async)
    mockExec
      // git status --porcelain (clean)
      .mockReturnValueOnce("")
      // bd show --json (merge verdict)
      .mockReturnValueOnce(JSON.stringify([issue]))
      // git switch main
      .mockReturnValueOnce("")
      // git merge
      .mockReturnValueOnce("")
      // bd close
      .mockReturnValueOnce("")
      // git branch -d
      .mockReturnValueOnce("");

    expect(await tick({ tickCount: 1 })).toEqual({ kind: "merged", issueId: "beads-test-abc", stdout: "" });

    const claudeCall = mockExecFile.mock.calls.find(
      (c) => c[0] === "claude",
    );
    const args = claudeCall?.[1] as string[];
    expect(args).toEqual(expect.arrayContaining(["--resume", "PREV-UUID"]));
  });

  it("handles implement: new branch even with leftover plan session-id", async () => {
    // plan phase の session-id が残っているが branch: ラベルがない場合は新規ブランチを作る
    const issue = makeIssue({
      labels: ["step:implement", "session-id:claude:PLAN-SESSION"],
    });

    mockExec
      .mockReturnValueOnce("[]") // bd ready (plan)
      .mockReturnValueOnce(JSON.stringify([issue])) // bd ready (implement)
      .mockReturnValueOnce("") // bd update (in_progress + assignee)
      .mockReturnValueOnce("") // git switch -c (new branch)
      .mockReturnValueOnce(""); // bd update (branch label)
    mockExecFileResolve(""); // claude command (async, new session, NOT resume)
    mockExec
      .mockReturnValueOnce("") // bd update (session label)
      .mockReturnValueOnce("") // git status (clean)
      .mockReturnValueOnce(JSON.stringify([issue])) // bd show (mergeVerdict)
      .mockReturnValueOnce("") // git switch main
      .mockReturnValueOnce("") // git merge
      .mockReturnValueOnce("") // bd close
      .mockReturnValueOnce(""); // git branch -d

    expect(await tick({ tickCount: 1 })).toEqual({ kind: "merged", issueId: "beads-test-abc", stdout: "" });

    const claudeCall = mockExecFile.mock.calls.find(
      (c) => c[0] === "claude",
    );
    const args = claudeCall?.[1] as string[];
    // resume ではなく新規セッション
    expect(args).toEqual(expect.arrayContaining(["--session-id"]));
    expect(args).not.toEqual(expect.arrayContaining(["--resume"]));
  });

  it("catches unsupported tool error and returns idle with error log", async () => {
    const mockError = vi.spyOn(console, "error").mockImplementation(() => {});
    const issue = makeIssue({
      labels: ["step:implement", "session-id:codex:SOME-ID"],
    });

    mockExec
      // bd ready --json (plan) → empty
      .mockReturnValueOnce("[]")
      // bd ready --json (implement)
      .mockReturnValueOnce(JSON.stringify([issue]));

    expect(await tick({ tickCount: 1 })).toEqual({ kind: "idle" });
    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining('Unsupported tool: codex'),
    );
    mockError.mockRestore();
  });

  it("handles implement: WAIT for feature-review", async () => {
    const issue = makeIssue({
      labels: ["step:implement", "needs:feature-review"],
    });

    mockExec
      // bd ready --json (plan) → empty
      .mockReturnValueOnce("[]")
      // bd ready --json (implement)
      .mockReturnValueOnce(JSON.stringify([issue]))
      // bd update (in_progress)
      .mockReturnValueOnce("")
      // git switch -c
      .mockReturnValueOnce("")
      // bd update (branch label)
      .mockReturnValueOnce("");
    mockExecFileResolve(""); // claude command (async)
    mockExec
      // bd update (add session label)
      .mockReturnValueOnce("")
      // git status --porcelain (clean)
      .mockReturnValueOnce("")
      // bd show --json (merge verdict)
      .mockReturnValueOnce(JSON.stringify([issue]))
      // git switch main
      .mockReturnValueOnce("");

    expect(await tick({ tickCount: 1 })).toEqual({
      kind: "agent-done",
      issueId: "beads-test-abc",
      verdict: "WAIT",
      stdout: "",
    });
  });

  it("handles implement: uncommitted files", async () => {
    const issue = makeIssue();

    mockExec
      // bd ready --json (plan) → empty
      .mockReturnValueOnce("[]")
      // bd ready --json (implement)
      .mockReturnValueOnce(JSON.stringify([issue]))
      // bd update (in_progress)
      .mockReturnValueOnce("")
      // git switch -c
      .mockReturnValueOnce("")
      // bd update (branch label)
      .mockReturnValueOnce("");
    mockExecFileResolve(""); // claude command (async)
    mockExec
      // bd update (add session label)
      .mockReturnValueOnce("")
      // git status --porcelain (dirty)
      .mockReturnValueOnce("M  src/forgot.ts");

    expect(await tick({ tickCount: 1 })).toEqual({
      kind: "uncommitted",
      issueId: "beads-test-abc",
      files: ["M  src/forgot.ts"],
      stdout: "",
    });
  });
});

// ---------------------------------------------------------------------------
// cleanup: merge failure safety
// ---------------------------------------------------------------------------

describe("cleanup merge failure", () => {
  const mockWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    mockWarn.mockClear();
  });

  it("returns merge-failed and skips close/deleteBranch when merge fails", async () => {
    const issue = makeIssue({ labels: ["step:implement"] });

    mockExec
      // bd ready --json (plan)
      .mockReturnValueOnce("[]")
      // bd ready --json (implement)
      .mockReturnValueOnce(JSON.stringify([issue]))
      // bd update (in_progress + assignee)
      .mockReturnValueOnce("")
      // git switch -c
      .mockReturnValueOnce("")
      // bd update (branch label)
      .mockReturnValueOnce("");
    mockExecFileResolve(""); // claude command (async)
    mockExec
      // bd update (session label)
      .mockReturnValueOnce("")
      // git status --porcelain (clean)
      .mockReturnValueOnce("")
      // bd show --json (mergeVerdict → MERGE)
      .mockReturnValueOnce(JSON.stringify([issue]))
      // git switch main
      .mockReturnValueOnce("")
      // git merge → FAILS
      .mockImplementationOnce(() => { throw new Error("merge conflict"); });

    const result = await tick({ tickCount: 1 });

    expect(result).toEqual({ kind: "merge-failed", issueId: "beads-test-abc" });

    // Warning was logged
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("merge failed for beads/tasks/beads-test-abc"),
    );

    // bd close and git branch -d should NOT have been called
    const calls = mockExec.mock.calls;
    expect(calls.filter((c) => c[0] === "bd" && (c[1] as string[]).includes("close"))).toHaveLength(0);
    expect(calls.filter((c) => c[0] === "git" && (c[1] as string[]).includes("-d"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// tick error handling
// ---------------------------------------------------------------------------

describe("tick error handling", () => {
  it("catches execOrThrow errors and returns idle", async () => {
    const mockError = vi.spyOn(console, "error").mockImplementation(() => {});
    const issue = makeIssue({ labels: ["step:implement"] });

    mockExec
      .mockReturnValueOnce("[]") // bd ready (plan)
      .mockReturnValueOnce(JSON.stringify([issue])) // bd ready (implement)
      .mockReturnValueOnce("") // bd update
      .mockImplementationOnce(() => { throw new Error("git switch -c failed"); }); // git switch -c fails

    const result = await tick({ tickCount: 1 });

    expect(result).toEqual({ kind: "idle" });
    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining("git switch -c failed"),
    );
    mockError.mockRestore();
  });

  it("catches async runClaudeCode errors and returns idle", async () => {
    const mockError = vi.spyOn(console, "error").mockImplementation(() => {});
    const issue = makeIssue({ labels: ["step:implement"] });

    mockExec
      .mockReturnValueOnce("[]") // bd ready (plan)
      .mockReturnValueOnce(JSON.stringify([issue])) // bd ready (implement)
      .mockReturnValueOnce("") // bd update (in_progress)
      .mockReturnValueOnce("") // git switch -c
      .mockReturnValueOnce(""); // bd update (branch label)
    mockExecFileReject("claude process failed"); // claude command fails (async)

    const result = await tick({ tickCount: 1 });

    expect(result).toEqual({ kind: "idle" });
    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining("claude process failed"),
    );
    mockError.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// shutdownState
// ---------------------------------------------------------------------------

describe("shutdownState", () => {
  beforeEach(() => {
    shutdownState.reset();
  });

  it("is not requested initially", () => {
    expect(shutdownState.isRequested()).toBe(false);
  });

  it("becomes requested after request()", () => {
    shutdownState.request();
    expect(shutdownState.isRequested()).toBe(true);
  });

  it("can be reset", () => {
    shutdownState.request();
    shutdownState.reset();
    expect(shutdownState.isRequested()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loop with graceful shutdown
// ---------------------------------------------------------------------------

describe("loop", () => {
  const mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(() => {
    mockLog.mockClear();
    shutdownState.reset();
  });

  it("exits after current tick when shutdown is requested", async () => {
    // Make tick return idle, and request shutdown before the loop starts
    mockExec
      .mockReturnValueOnce("[]")   // bd ready (plan)
      .mockReturnValueOnce("[]");  // bd ready (implement)

    shutdownState.request();

    await loop({ intervalMs: 0 });

    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining("Shutdown complete"),
    );
  });

  it("returns Promise<void> (not Promise<never>)", async () => {
    mockExec
      .mockReturnValueOnce("[]")
      .mockReturnValueOnce("[]");

    shutdownState.request();

    const result = await loop({ intervalMs: 0 });
    expect(result).toBeUndefined();
  });

  it("registers signal handlers", async () => {
    const onSpy = vi.spyOn(process, "on");

    mockExec
      .mockReturnValueOnce("[]")
      .mockReturnValueOnce("[]");

    shutdownState.request();

    await loop({ intervalMs: 0 });

    expect(onSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));

    onSpy.mockRestore();
  });
});
