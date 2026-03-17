// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IssueStatus = "open" | "in_progress" | "blocked" | "deferred" | "closed";

export type Issue = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: IssueStatus;
  readonly priority: string;
  readonly type: string;
  readonly labels: readonly string[];
  readonly acceptance_criteria?: string;
  readonly comments?: readonly string[];
};

export type MergeVerdict = "MERGE" | "WAIT";

export type LoopResult =
  | { readonly kind: "idle" }
  | { readonly kind: "planned"; readonly issueId: string; readonly stdout: string }
  | { readonly kind: "agent-done"; readonly issueId: string; readonly verdict: MergeVerdict; readonly stdout: string }
  | { readonly kind: "merged"; readonly issueId: string; readonly stdout: string }
  | { readonly kind: "merge-failed"; readonly issueId: string }
  | { readonly kind: "uncommitted"; readonly issueId: string; readonly files: readonly string[]; readonly stdout: string }
  | { readonly kind: "architect-review"; readonly architectStdout: string; readonly pdmStdout: string };

export type SessionInfo = { readonly tool: string; readonly sessionId: string };
export type ClaudeCodeResult = { readonly sessionId: string; readonly stdout: string };

export type ExecResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: Error };
