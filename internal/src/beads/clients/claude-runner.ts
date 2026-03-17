import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { beadsClient } from "./beads-client.ts";
import type { ClaudeCodeResult, SessionInfo } from "../types.ts";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Claude Code runner
// ---------------------------------------------------------------------------

export const extractSessionId = (labels: readonly string[]): SessionInfo | undefined => {
  const sessionLabel = labels.find((l) => l.startsWith("session-id:"));
  if (!sessionLabel) return undefined;

  const [tool, sessionId] = sessionLabel.replace("session-id:", "").split(':');
  if (tool === undefined || sessionId === undefined) {
    return undefined;
  }
  return { tool, sessionId };
};

export const runClaudeCode = async (prompt: string, opts: {
  issueId?: string,
  disableClaudeCodeSystemPrompt?: boolean,
  agent?: string
} & ({
  resume: string
} | {
  resume: undefined
})): Promise<ClaudeCodeResult> => {
  const sessionId = typeof opts.resume === 'string' ? opts.resume : randomUUID();
  const args = [
    "--dangerously-skip-permissions",
    "--append-system-prompt", `session-id: ${sessionId}`,
    ...(typeof opts.resume === 'string'
      ? ["--resume", sessionId]
      : ["--session-id", sessionId]),
    ...((opts.disableClaudeCodeSystemPrompt ?? false)
      ? ["--system-prompt", ""]
      : []),
    ...(typeof opts.agent === 'string'
      ? ["--agent", opts.agent]
      : []),
    "-p", prompt,
  ] as const;

  const { stdout } = await execFileAsync("claude", args, {
    encoding: "utf-8",
    timeout: 1_800_000, // 30 minutes
  });

  if (typeof opts.resume !== 'string' && typeof opts.issueId === 'string') {
    beadsClient.update(opts.issueId, {
      addLabels: [`session-id:claude:${sessionId}`],
    });
  }

  return { sessionId, stdout: stdout.trim() };
};
