import { execFileSync } from "node:child_process";
import type { ExecResult } from "./types.ts";

// ---------------------------------------------------------------------------
// Warning helper — non-blocking alerts for implicit state issues
// ---------------------------------------------------------------------------

export const warn = (message: string): void => {
  console.warn(`[beads-loop:warn] ${message}`);
};

// ---------------------------------------------------------------------------
// Shell helpers
// ---------------------------------------------------------------------------

const execResult = (cmd: string, args: readonly string[]): ExecResult => {
  try {
    return { ok: true, value: execFileSync(cmd, args, { encoding: "utf-8" }).trim() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
};

export const execOrThrow = (cmd: string, args: readonly string[]): string => {
  const result = execResult(cmd, args);
  if (!result.ok) throw result.error;
  return result.value;
};

export const execSafe = (cmd: string, args: readonly string[]): string => {
  const result = execResult(cmd, args);
  if (!result.ok) {
    warn(`Command failed (safe): ${cmd} ${args.join(" ").slice(0, 80)} — ${result.error.message.slice(0, 120)}`);
    return "";
  }
  return result.value;
};
