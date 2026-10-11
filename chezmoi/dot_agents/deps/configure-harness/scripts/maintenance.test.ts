import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dueTasks, parseDuration, parseManifest } from "../exact_templates/auto-pilot/dot_agents/auto-pilot/scripts/maintenance.ts";

const NOW = new Date("2026-10-10T12:00:00Z");
const noCommits = () => 0;

describe("parseDuration", () => {
  it("reads hours and days", () => {
    assert.equal(parseDuration("6h"), 6 * 60 * 60 * 1000);
    assert.equal(parseDuration("7d"), 7 * 24 * 60 * 60 * 1000);
  });

  it("rejects other forms", () => {
    assert.equal(parseDuration("1w"), null);
    assert.equal(parseDuration("d"), null);
    assert.equal(parseDuration("0d"), null);
  });
});

describe("parseManifest", () => {
  it("accepts tasks with every and afterCommits", () => {
    const result = parseManifest({ tasks: { "sprint-report": { every: "7d", afterCommits: 10 } } });
    assert.deepEqual(result, {
      kind: "ok",
      manifest: { tasks: { "sprint-report": { every: 7 * 24 * 60 * 60 * 1000, afterCommits: 10 } } },
    });
  });

  it("reports a task without a trigger and a malformed duration", () => {
    const result = parseManifest({ tasks: { a: {}, b: { every: "1w" } } });
    assert.deepEqual(result, {
      kind: "error",
      errors: ["a: set `every` or `afterCommits`", "b: `every` must be like 6h or 7d"],
    });
  });

  it("reports a manifest without tasks", () => {
    assert.deepEqual(parseManifest({}), { kind: "error", errors: ["`tasks` must be an object"] });
  });
});

describe("dueTasks", () => {
  const manifest = { tasks: { report: { every: 24 * 60 * 60 * 1000, afterCommits: 10 } } };

  it("is due when the task has never run", () => {
    assert.deepEqual(dueTasks(manifest, {}, NOW, noCommits), [{ name: "report", reasons: [{ kind: "never-run" }] }]);
  });

  it("is not due before any trigger is reached", () => {
    const lastRun = { report: { at: "2026-10-10T00:00:00Z", commit: "abc" } };
    assert.deepEqual(dueTasks(manifest, lastRun, NOW, () => 9), []);
  });

  it("is due when the interval has passed", () => {
    const lastRun = { report: { at: "2026-10-09T11:00:00Z", commit: "abc" } };
    assert.deepEqual(dueTasks(manifest, lastRun, NOW, noCommits), [
      { name: "report", reasons: [{ kind: "elapsed", since: "2026-10-09T11:00:00Z" }] },
    ]);
  });

  it("is due when enough commits have landed, counting from the last run's commit", () => {
    const lastRun = { report: { at: "2026-10-10T00:00:00Z", commit: "abc" } };
    const seen: string[] = [];
    const due = dueTasks(manifest, lastRun, NOW, (commit) => {
      seen.push(commit);
      return 10;
    });
    assert.deepEqual(seen, ["abc"]);
    assert.deepEqual(due, [{ name: "report", reasons: [{ kind: "commits", count: 10 }] }]);
  });

  it("is due when the last run's commit is no longer in the history", () => {
    const lastRun = { report: { at: "2026-10-10T00:00:00Z", commit: "gone" } };
    assert.deepEqual(dueTasks(manifest, lastRun, NOW, () => null), [
      { name: "report", reasons: [{ kind: "commit-unknown", commit: "gone" }] },
    ]);
  });
});
