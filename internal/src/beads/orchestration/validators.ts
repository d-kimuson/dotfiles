import { beadsClient } from "../clients/beads-client.ts";
import { git, branchFor } from "../clients/git-client.ts";
import { warn } from "../exec.ts";
import type { LoopResult, MergeVerdict } from "../types.ts";

// ---------------------------------------------------------------------------
// Post-action validators — warn on implicit state issues, never block
// ---------------------------------------------------------------------------

export const validatePostPlan = (issueId: string): void => {
  const issue = beadsClient.show(issueId);
  if (!issue) return;

  const hasStepPlan = issue.labels.includes("step:plan");
  const hasStepImplement = issue.labels.includes("step:implement");
  const hasGate = issue.labels.some((l) => l.startsWith("gate:"));

  if (hasStepPlan && !hasStepImplement && !hasGate) {
    warn(
      `${issueId}: bd-pdm 完了後も step:plan が残っています。step:implement への遷移または gate 作成が行われていない可能性があります`,
    );
  }
};

export const mergeVerdict = (issueId: string): MergeVerdict => {
  const issue = beadsClient.show(issueId);
  if (!issue) return "WAIT";
  const { labels } = issue;

  if (labels.includes("needs:feature-review") && issue.type !== "feature") {
    warn(
      `${issueId}: needs:feature-review が feature 以外の type "${issue.type}" に付与されています`,
    );
  }

  const needsCheck = labels.includes("needs:feature-review");
  const approved = labels.includes("feature-review:approved");
  return !needsCheck || approved ? "MERGE" : "WAIT";
};

export const cleanup = (issueId: string, stdout: string): LoopResult => {
  const uncommitted = git.uncommittedNonBeadsFiles();
  if (uncommitted.length > 0) {
    return { kind: "uncommitted", issueId, files: uncommitted, stdout };
  }

  const verdict = mergeVerdict(issueId);
  if (verdict === "MERGE") {
    const branch = branchFor(issueId);
    git.switchMain();
    try {
      git.merge(branch);
      beadsClient.close(issueId);
      git.deleteBranch(branch);
    } catch (e) {
      warn(`merge failed for ${branch}, skipping close/delete: ${e instanceof Error ? e.message : String(e)}`);
      return { kind: "merge-failed", issueId };
    }
    return { kind: "merged", issueId, stdout };
  }

  git.switchMain();
  return { kind: "agent-done", issueId, verdict: "WAIT", stdout };
};
