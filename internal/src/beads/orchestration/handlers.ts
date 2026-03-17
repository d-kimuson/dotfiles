import { beadsClient } from "../clients/beads-client.ts";
import { git, branchFor } from "../clients/git-client.ts";
import { extractSessionId, runClaudeCode } from "../clients/claude-runner.ts";
import { validatePostPlan, cleanup } from "./validators.ts";
import type { Issue, LoopResult } from "../types.ts";

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const handlePlan = async (issue: Issue): Promise<LoopResult> => {
  console.log(`[beads-loop] handlePlan: ${issue.id} "${issue.title}"`);
  beadsClient.update(issue.id, { status: "in_progress", assignee: "bd-pdm" });

  try {
    const prompt = `/bd:auto-task ${issue.id} の issue のリファインメントを行ってください。`;
    console.log(`[beads-loop] >> UserMessage(bd-pdm): ${prompt}`);
    const { stdout } = await runClaudeCode(prompt, {
      issueId: issue.id,
      disableClaudeCodeSystemPrompt: true,
      resume: undefined,
      agent: 'bd-pdm'
    });
    console.log(`[beads-loop] << AssistantMessage(bd-pdm): ${stdout}`);

    validatePostPlan(issue.id);

    return { kind: "planned", issueId: issue.id, stdout };
  } catch (e) {
    beadsClient.update(issue.id, { status: "open" });
    throw e;
  }
};

export const handleImplement = async (issue: Issue): Promise<LoopResult> => {
  console.log(`[beads-loop] handleImplement: ${issue.id} "${issue.title}"`);

  const hasBranch = issue.labels.some((l) => l.startsWith("branch:"));
  const existingSession = extractSessionId(issue.labels);

  if (existingSession !== undefined && existingSession.tool !== "claude") {
    throw new Error(`Unsupported tool: ${existingSession.tool} (only "claude" is supported)`);
  }

  const branch = branchFor(issue.id);
  if (hasBranch) {
    git.switch(branch);
  } else {
    beadsClient.update(issue.id, { status: "in_progress", assignee: "bd-engineer" });
    git.switchNew(branch);
    beadsClient.update(issue.id, { addLabels: [`branch:${branch}`] });
  }

  try {
    const isResume = hasBranch && existingSession !== undefined;
    const prompt = isResume
      ? `/bd:auto-task ${issue.id} の issue が re-open されました。再開してください。`
      : `/bd:auto-task ${issue.id} の issue の実装を行ってください。`;
    console.log(`[beads-loop] >> UserMessage(bd-engineer): ${prompt}`);
    const { stdout } = await runClaudeCode(prompt, {
      issueId: issue.id,
      resume: isResume ? existingSession.sessionId : undefined,
      agent: 'bd-engineer'
    });
    console.log(`[beads-loop] << AssistantMessage(bd-engineer): ${stdout}`);

    return cleanup(issue.id, stdout);
  } catch (e) {
    beadsClient.update(issue.id, { status: "open" });
    throw e;
  }
};

export const handleArchitectReview = async (): Promise<LoopResult> => {
  const architectPrompt = `/bd:auto-task 現在のソースコード全体に対してアーキテクチャレビューを実施してください。`;
  console.log(`[beads-loop] >> UserMessage(bd-architect): ${architectPrompt}`);
  const { stdout: architectStdout } = await runClaudeCode(architectPrompt, {
    disableClaudeCodeSystemPrompt: false,
    resume: undefined,
    agent: 'bd-architect'
  });
  console.log(`[beads-loop] << AssistantMessage(bd-architect): ${architectStdout}`);

  const pdmPrompt = `/bd:auto-task アーキテクトによるレビューが実施されました。` +
    `レビュー内容を確認しタスクを分解して起票してください。\n\n\nArchitect Output:\n${architectStdout}`;
  console.log(`[beads-loop] >> UserMessage(bd-pdm): ${pdmPrompt}`);
  const { stdout: pdmStdout } = await runClaudeCode(pdmPrompt, {
    disableClaudeCodeSystemPrompt: true,
    resume: undefined,
    agent: 'bd-pdm'
  });
  console.log(`[beads-loop] << AssistantMessage(bd-pdm): ${pdmStdout}`);

  if (git.commitDocsIfDirty()) {
    console.log(`[beads-loop] docs/ changes committed from architect review`);
  }

  return { kind: "architect-review", architectStdout, pdmStdout };
};
