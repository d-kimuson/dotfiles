// Tells which maintenance tasks are due. Run with Node.js 24.2+ from the repository root:
//
//   node .agents/auto-pilot/scripts/maintenance.ts due           the due tasks, each with why and its procedure
//   node .agents/auto-pilot/scripts/maintenance.ts done <name>   record that <name> ran now, at HEAD
//
// Triggers live in maintenance-tasks/manifest.json (tracked): `every` ("6h", "7d") and `afterCommits`
// (first-parent commits on HEAD since the last run). A task is due when it never ran or any trigger is reached.
// Last runs live in maintenance-tasks/last-run.json (ignored by Git).

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Trigger = { readonly every?: number; readonly afterCommits?: number };
export type Manifest = { readonly tasks: Readonly<Record<string, Trigger>> };
export type LastRun = Readonly<Record<string, { readonly at: string; readonly commit: string }>>;

export type Reason =
  | { readonly kind: "never-run" }
  | { readonly kind: "elapsed"; readonly since: string }
  | { readonly kind: "commits"; readonly count: number }
  | { readonly kind: "commit-unknown"; readonly commit: string };

export type Due = { readonly name: string; readonly reasons: readonly Reason[] };

// Commits on HEAD's first-parent line since `commit`, or null when `commit` is not in the history
export type CountCommits = (commit: string) => number | null;

const UNIT_MS = { h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 } as const;

export const parseDuration = (text: string): number | null => {
  const match = /^([1-9]\d*)([hd])$/.exec(text);
  if (match === null) return null;
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseManifest = (
  value: unknown,
): { readonly kind: "ok"; readonly manifest: Manifest } | { readonly kind: "error"; readonly errors: readonly string[] } => {
  if (!isRecord(value) || !isRecord(value["tasks"])) return { kind: "error", errors: ["`tasks` must be an object"] };

  const tasks: Record<string, Trigger> = {};
  const errors: string[] = [];
  for (const [name, raw] of Object.entries(value["tasks"])) {
    const trigger = isRecord(raw) ? raw : {};
    const rawEvery = trigger["every"];
    const rawAfterCommits = trigger["afterCommits"];

    if (rawEvery === undefined && rawAfterCommits === undefined) {
      errors.push(`${name}: set \`every\` or \`afterCommits\``);
      continue;
    }
    const every = typeof rawEvery === "string" ? parseDuration(rawEvery) : null;
    if (rawEvery !== undefined && every === null) {
      errors.push(`${name}: \`every\` must be like 6h or 7d`);
      continue;
    }
    const afterCommits = typeof rawAfterCommits === "number" && Number.isInteger(rawAfterCommits) && rawAfterCommits > 0 ? rawAfterCommits : null;
    if (rawAfterCommits !== undefined && afterCommits === null) {
      errors.push(`${name}: \`afterCommits\` must be a positive integer`);
      continue;
    }
    tasks[name] = {
      ...(every === null ? {} : { every }),
      ...(afterCommits === null ? {} : { afterCommits }),
    };
  }

  return errors.length > 0 ? { kind: "error", errors } : { kind: "ok", manifest: { tasks } };
};

const reasonsFor = (trigger: Trigger, last: LastRun[string] | undefined, now: Date, countCommits: CountCommits): Reason[] => {
  if (last === undefined) return [{ kind: "never-run" }];

  const reasons: Reason[] = [];
  if (trigger.every !== undefined && now.getTime() - new Date(last.at).getTime() >= trigger.every) {
    reasons.push({ kind: "elapsed", since: last.at });
  }
  if (trigger.afterCommits !== undefined) {
    const count = countCommits(last.commit);
    if (count === null) reasons.push({ kind: "commit-unknown", commit: last.commit });
    else if (count >= trigger.afterCommits) reasons.push({ kind: "commits", count });
  }
  return reasons;
};

export const dueTasks = (manifest: Manifest, lastRun: LastRun, now: Date, countCommits: CountCommits): Due[] =>
  Object.entries(manifest.tasks)
    .map(([name, trigger]) => ({ name, reasons: reasonsFor(trigger, lastRun[name], now, countCommits) }))
    .filter((due) => due.reasons.length > 0);

const describeReason = (reason: Reason): string => {
  switch (reason.kind) {
    case "never-run":
      return "never run";
    case "elapsed":
      return `interval passed since ${reason.since}`;
    case "commits":
      return `${reason.count} commits since the last run`;
    case "commit-unknown":
      return `the last run's commit ${reason.commit} is not in the history`;
  }
};

const DIRECTORY = join(".agents", "auto-pilot", "maintenance-tasks");
const MANIFEST = join(DIRECTORY, "manifest.json");
const LAST_RUN = join(DIRECTORY, "last-run.json");

const git = (...args: string[]): string => execFileSync("git", args, { encoding: "utf8" }).trim();

const countCommits: CountCommits = (commit) => {
  try {
    git("merge-base", "--is-ancestor", commit, "HEAD");
    return Number(git("rev-list", "--count", "--first-parent", `${commit}..HEAD`));
  } catch {
    return null;
  }
};

const readManifest = (): Manifest => {
  const parsed = parseManifest(JSON.parse(readFileSync(MANIFEST, "utf8")));
  if (parsed.kind === "error") {
    process.stderr.write(`${MANIFEST}:\n${parsed.errors.map((error) => `  ${error}`).join("\n")}\n`);
    process.exit(1);
  }
  return parsed.manifest;
};

const readLastRun = (): LastRun => (existsSync(LAST_RUN) ? (JSON.parse(readFileSync(LAST_RUN, "utf8")) as LastRun) : {});

const main = (args: readonly string[]): void => {
  const [command, name] = args;
  switch (command) {
    case "due": {
      const due = dueTasks(readManifest(), readLastRun(), new Date(), countCommits);
      if (due.length === 0) process.stdout.write("no maintenance task is due\n");
      for (const task of due) {
        const reasons = task.reasons.map(describeReason).join(", ");
        process.stdout.write(`${task.name}: ${reasons} -> ${join(DIRECTORY, task.name, "index.md")}\n`);
      }
      return;
    }
    case "done": {
      if (name === undefined || !(name in readManifest().tasks)) {
        process.stderr.write(`unknown task: ${name ?? "(none)"}\n`);
        process.exit(2);
      }
      const lastRun = { ...readLastRun(), [name]: { at: new Date().toISOString(), commit: git("rev-parse", "HEAD") } };
      writeFileSync(LAST_RUN, `${JSON.stringify(lastRun, null, 2)}\n`);
      return;
    }
    default:
      process.stderr.write("usage: node .agents/auto-pilot/scripts/maintenance.ts due | done <name>\n");
      process.exit(2);
  }
};

if (import.meta.main) main(process.argv.slice(2));
