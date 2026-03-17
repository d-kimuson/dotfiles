import { execOrThrow, execSafe } from "../exec.ts";

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

export const git = {
  switch: (branch: string): void => {
    execOrThrow("git", ["switch", branch]);
  },

  switchNew: (branch: string): void => {
    execOrThrow("git", ["switch", "-c", branch]);
  },

  switchMain: (): void => {
    execOrThrow("git", ["switch", "main"]);
  },

  merge: (branch: string): void => {
    execOrThrow("git", ["merge", branch]);
  },

  deleteBranch: (branch: string): void => {
    execOrThrow("git", ["branch", "-d", branch]);
  },

  commitDocsIfDirty: (): boolean => {
    const diff = execSafe("git", ["diff", "--name-only", "docs/"]);
    const untracked = execSafe("git", ["ls-files", "--others", "--exclude-standard", "docs/"]);
    const files = [...diff.split("\n"), ...untracked.split("\n")].filter(Boolean);
    if (files.length === 0) return false;
    execOrThrow("git", ["add", "docs/"]);
    execOrThrow("git", ["commit", "-m", "docs: update from architect review"]);
    return true;
  },

  uncommittedNonBeadsFiles: (): readonly string[] => {
    const raw = execSafe("git", ["status", "--porcelain"]);
    if (!raw) return [];
    return raw.split("\n").filter((line) => !line.match(/^.. \.beads\//));
  },
};

export const branchFor = (issueId: string): string => `beads/tasks/${issueId}`;
