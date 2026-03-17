import { execOrThrow, execSafe, warn } from "../exec.ts";
import type { Issue, IssueStatus } from "../types.ts";

// ---------------------------------------------------------------------------
// Beads client
// ---------------------------------------------------------------------------

export const beadsClient = {
  ready: (filters: {
    readonly label?: string;
    readonly type?: string;
  }): readonly Issue[] => {
    const args = [
      "ready", "--json",
      ...(filters.label ? ["--label", filters.label] : []),
      ...(filters.type ? ["--type", filters.type] : []),
    ] as const;
    const raw = execSafe("bd", args);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as readonly Issue[];
    } catch {
      warn(`Failed to parse ready JSON: ${raw.slice(0, 100)}`);
      return [];
    }
  },

  show: (issueId: string): Issue | undefined => {
    const raw = execSafe("bd", ["show", issueId, "--json"]);
    if (!raw) return undefined;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed[0] ?? undefined;
      return undefined;
    } catch {
      warn(`Failed to parse show JSON: ${raw.slice(0, 100)}`);
      return undefined;
    }
  },

  update: (
    issueId: string,
    opts: {
      readonly status?: IssueStatus;
      readonly assignee?: string;
      readonly addLabels?: readonly string[];
      readonly removeLabels?: readonly string[];
      readonly acceptance?: string;
    },
  ): void => {
    const args = [
      "update", issueId,
      ...(opts.status ? ["--status", opts.status] : []),
      ...(opts.assignee ? ["--assignee", opts.assignee] : []),
      ...(opts.addLabels ?? []).flatMap(l => ["--add-label", l]),
      ...(opts.removeLabels ?? []).flatMap(l => ["--remove-label", l]),
      ...(opts.acceptance ? ["--acceptance", opts.acceptance] : []),
    ] as const;
    execOrThrow("bd", args);
  },

  close: (issueId: string): void => {
    execOrThrow("bd", ["close", issueId]);
  },

  commentsAdd: (issueId: string, comment: string): void => {
    execSafe("bd", ["comments", "add", issueId, comment]);
  },
};
