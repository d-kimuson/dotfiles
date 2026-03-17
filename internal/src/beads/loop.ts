import { setTimeout } from "node:timers/promises";
import { beadsClient } from "./clients/beads-client.ts";
import { handlePlan, handleImplement, handleArchitectReview } from "./orchestration/handlers.ts";
import type { LoopResult } from "./types.ts";

// ---------------------------------------------------------------------------
// Single tick — find work, execute one task cycle
// ---------------------------------------------------------------------------

export const tick = async (opts: {
  tickCount: number,
}): Promise<LoopResult> => {
  try {
    // plan takes priority over implement
    const planIssues = beadsClient.ready({ label: "step:plan" });
    if (planIssues.length > 0 && planIssues[0]) {
      console.log(`[beads-loop(${opts.tickCount})] process=plan started`);
      return await handlePlan(planIssues[0]);
    }

    const implementIssues = beadsClient.ready({ label: "step:implement" });
    if (implementIssues.length > 0 && implementIssues[0]) {
      console.log(`[beads-loop(${opts.tickCount})] process=implement started`);
      return await handleImplement(implementIssues[0]);
    }

    console.log(`[beads-loop(${opts.tickCount})] no ready issues found. skip.`);
    return { kind: "idle" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[beads-loop(${opts.tickCount})] tick failed: ${message}`);
    return { kind: "idle" };
  }
};

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

export const shutdownState = (() => {
  let requested = false;
  return {
    request: (): void => { requested = true; },
    isRequested: (): boolean => requested,
    reset: (): void => { requested = false; },
  };
})();

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

export const DEFAULT_INTERVAL_MS = 10_000;
export const DEFAULT_ARCHITECT_REVIEW_INTERVAL = 5;

export const loop = async (opts: {
  readonly intervalMs?: number;
  readonly architectReviewInterval?: number;
} = {}): Promise<void> => {
  const {
    intervalMs = DEFAULT_INTERVAL_MS,
    architectReviewInterval = DEFAULT_ARCHITECT_REVIEW_INTERVAL,
  } = opts;

  const onSignal = (signal: string) => {
    console.log(`[beads-loop] Received ${signal}, shutting down after current tick...`);
    shutdownState.request();
  };
  process.on("SIGINT", () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));

  let tickCount = 0;
  let workCount = 0;

  while (!shutdownState.isRequested()) {
    tickCount++;
    const result = await tick({ tickCount });
    console.log(`[beads-loop(${tickCount})] process completed. ${result.kind}`);
    if (result.kind === "merge-failed") {
      console.log(`[beads-loop(${tickCount})] merge failed for ${result.issueId}, treating as WAIT`);
    }

    // idle 以外の実作業をカウントし、N回ごとにアーキテクトレビュー
    const isWork = result.kind !== "idle";
    if (isWork) workCount++;
    if (workCount > 0 && workCount % architectReviewInterval === 0 && !shutdownState.isRequested()) {
      console.log(`[beads-loop(${tickCount})] process=architect-review started (after ${workCount} work ticks)`);
      const reviewResult = await handleArchitectReview();
      console.log(`[beads-loop(${tickCount})] process completed. ${reviewResult.kind}`);
    }

    if ((result.kind === "idle" || result.kind === "merge-failed") && !shutdownState.isRequested()) {
      await setTimeout(intervalMs);
    }
  }

  console.log("[beads-loop] Shutdown complete.");
};
