import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type Completion = "only-edit" | "commit" | "pr" | "draft-pr";
type MergeCondition = "none" | "always" | "ci-passed" | "review-fixed" | "approved";
type Phase = "idle" | "waiting-for-main" | "review-requested" | "approved" | "pr-requested" | "done";

type Config = {
	staticChecks?: string[];
	completion: Completion;
	mergeCondition: MergeCondition;
	acceptanceCriteria: string;
	maxIterations?: number;
};

type State = {
	active: boolean;
	phase: Phase;
	iteration: number;
	config: Config;
	lastPrUrl?: string;
};

type ExecResult = { code?: number; stdout?: string; stderr?: string; killed?: boolean };

type SubagentResponse = {
	requestId?: string;
	isError?: boolean;
	errorText?: string;
	result?: { content?: string | Array<{ type?: string; text?: string }> };
};

const DEFAULT_MAX_ITERATIONS = 25;
const SLASH_SUBAGENT_REQUEST_EVENT = "subagent:slash:request";
const SLASH_SUBAGENT_STARTED_EVENT = "subagent:slash:started";
const SLASH_SUBAGENT_RESPONSE_EVENT = "subagent:slash:response";
const OUTPUT_LIMIT = 12_000;
const REVIEWER_START_TIMEOUT_MS = 10_000;
const REVIEWER_RESPONSE_TIMEOUT_MS = 15 * 60_000;

const truncate = (text: string, max = OUTPUT_LIMIT): string => {
	if (text.length <= max) return text;
	return `${text.slice(0, max)}\n\n[truncated ${text.length - max} chars]`;
};

const quoteShell = (command: string): string => command;

const formatExec = (result: ExecResult): string => {
	const out = [
		`exitCode: ${result.code ?? "unknown"}${result.killed ? " (killed)" : ""}`,
		result.stdout ? `stdout:\n${result.stdout}` : undefined,
		result.stderr ? `stderr:\n${result.stderr}` : undefined,
	].filter(Boolean).join("\n\n");
	return truncate(out || "(no output)");
};

const extractText = (content: SubagentResponse["result"] extends infer R ? R extends { content?: infer C } ? C : never : never): string => {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n");
};

const parseReviewDecision = (text: string): { approved: boolean; feedback: string } => {
	const jsonMatch = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/\{[\s\S]*"approved"[\s\S]*\}/);
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[1] ?? jsonMatch[0]) as { approved?: unknown; feedback?: unknown };
			if (typeof parsed.approved === "boolean") return { approved: parsed.approved, feedback: typeof parsed.feedback === "string" ? parsed.feedback : text };
		} catch {}
	}
	return { approved: false, feedback: `Reviewer did not return a parseable approval JSON. Treating as rejected.\n\n${text}` };
};

const safeMergeCondition = (completion: Completion, mergeCondition: MergeCondition): MergeCondition => {
	if (completion !== "pr" && completion !== "draft-pr") return "none";
	return mergeCondition;
};

export default function ralphLoopExtension(pi: ExtensionAPI) {
	let state: State | undefined;
	let running = false;

	const persist = () => {
		if (state) pi.appendEntry("ralph-loop-state", state);
	};

	const run = async (command: string, ctx: ExtensionContext, timeout = 10 * 60_000): Promise<ExecResult> => {
		return await pi.exec("bash", ["-lc", quoteShell(command)], { cwd: ctx.cwd, signal: ctx.signal, timeout });
	};

	const git = async (args: string[], ctx: ExtensionContext): Promise<ExecResult> => {
		return await pi.exec("git", args, { cwd: ctx.cwd, signal: ctx.signal, timeout: 60_000 });
	};

	const sendFollowUp = (message: string) => {
		pi.sendUserMessage(message, { deliverAs: "followUp" });
	};

	const runStaticChecks = async (ctx: ExtensionContext, config: Config): Promise<string | undefined> => {
		for (const command of config.staticChecks ?? []) {
			const result = await run(command, ctx);
			if ((result.code ?? 1) !== 0) {
				return `Static check failed: \`${command}\`\n\n${formatExec(result)}`;
			}
		}
		return undefined;
	};

	const ensureCompletion = async (ctx: ExtensionContext, config: Config): Promise<string | undefined> => {
		if (config.completion === "only-edit") return undefined;
		const status = await git(["status", "--porcelain"], ctx);
		if (status.stdout?.trim()) {
			return `completion=${config.completion} was requested, but the worktree still has uncommitted changes. Commit the final changes before completing.`;
		}
		const log = await git(["log", "--oneline", "-1"], ctx);
		if ((log.code ?? 1) !== 0 || !log.stdout?.trim()) {
			return `completion=${config.completion} was requested, but no commit could be verified. Commit the final changes.`;
		}
		return undefined;
	};

	const runReviewerSubagent = async (ctx: ExtensionContext, config: Config): Promise<{ approved: boolean; feedback: string; output: string }> => {
		ctx.ui.setStatus("ralph-loop", undefined);
		const requestId = `ralph-loop-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const task = `ralph-loop review phase. Review the current session and git changes.\n\nCheck all of the following:\n- Verify the user's goal is achieved.\n- Verify completion policy: ${config.completion}. If it is not only-edit, confirm the final work is committed.\n- Verify acceptanceCriteria is necessary and sufficient: ${config.acceptanceCriteria}\n- Review code against project guidelines and general best practices.\n- Reject if requirements are unmet, unnecessary implementation exists, tests/checks are insufficient, or code quality issues remain.\n\nReturn your final decision as a JSON object in a json code block exactly like:\n\`\`\`json\n{\"approved\": false, \"feedback\": \"concrete fix instructions, or approval rationale\"}\n\`\`\``;
		let response: SubagentResponse;
		try {
			response = await new Promise<SubagentResponse>((resolve, reject) => {
				let done = false;
				let started = false;
				let unsubStarted: (() => void) | undefined;
				let unsubResponse: (() => void) | undefined;
				let startTimeout: ReturnType<typeof setTimeout> | undefined;
				let responseTimeout: ReturnType<typeof setTimeout> | undefined;
				const finish = (fn: () => void) => {
					if (done) return;
					done = true;
					if (startTimeout) clearTimeout(startTimeout);
					if (responseTimeout) clearTimeout(responseTimeout);
					unsubStarted?.();
					unsubResponse?.();
					fn();
				};
				startTimeout = setTimeout(() => {
					if (!started) finish(() => reject(new Error("No subagent bridge responded. Is pi-subagents loaded?")));
				}, REVIEWER_START_TIMEOUT_MS);
				responseTimeout = setTimeout(() => finish(() => reject(new Error("reviewer subagent timed out"))), REVIEWER_RESPONSE_TIMEOUT_MS);
				unsubStarted = pi.events.on(SLASH_SUBAGENT_STARTED_EVENT, (data: unknown) => {
					if ((data as { requestId?: unknown })?.requestId !== requestId) return;
					started = true;
					if (startTimeout) clearTimeout(startTimeout);
					ctx.ui.setStatus("ralph-loop", "reviewer running...");
				});
				unsubResponse = pi.events.on(SLASH_SUBAGENT_RESPONSE_EVENT, (data: unknown) => {
					const response = data as SubagentResponse;
					if (response?.requestId !== requestId) return;
					finish(() => resolve(response));
				});
				pi.events.emit(SLASH_SUBAGENT_REQUEST_EVENT, {
					requestId,
					params: { agent: "reviewer", task, context: "fork", cwd: ctx.cwd, outputMode: "inline" },
				});
			});
		} finally {
			ctx.ui.setStatus("ralph-loop", undefined);
		}
		const output = extractText(response.result?.content ?? "") || response.errorText || "(no reviewer output)";
		pi.sendMessage({ customType: "ralph-loop-review", content: `## ralph-loop reviewer result\n\n${output}`, display: true });
		if (response.isError) return { approved: false, feedback: output, output };
		return { ...parseReviewDecision(output), output };
	};

	const ensurePrOrRequestAgent = async (ctx: ExtensionContext, config: Config): Promise<{ url?: string; pending: boolean }> => {
		if (config.completion !== "pr" && config.completion !== "draft-pr") return { pending: false };
		const existing = await run("gh pr view --json url --jq .url", ctx, 60_000);
		if ((existing.code ?? 1) === 0 && existing.stdout?.trim()) return { url: existing.stdout.trim(), pending: false };

		const mode = config.completion === "draft-pr" ? "Draft PR" : "PR";
		state = { ...state!, phase: "pr-requested" };
		persist();
		sendFollowUp(`ralph-loop PR creation phase. Create a ${mode} using gh CLI, then finish the turn.\n\nRequirements:\n- Use \`git rev-parse --show-toplevel\` to locate the repository root.\n- Read PR template files under \`$(git rev-parse --show-toplevel)/.github\` if present, including common files such as \`.github/pull_request_template.md\` and files under \`.github/PULL_REQUEST_TEMPLATE/\`.\n- Use the template content as context and fill a meaningful PR title/body that accurately describes the committed changes and validation results.\n- Create the ${mode} with gh CLI${config.completion === "draft-pr" ? " using --draft" : ""}.\n- Do not merge. ralph-loop will handle mergeCondition after the PR exists.\n\nAcceptance criteria originally requested by the user:\n${config.acceptanceCriteria}`);
		return { pending: true };
	};

	const waitForCi = async (ctx: ExtensionContext): Promise<string | undefined> => {
		const result = await run("gh pr checks --watch --fail-fast", ctx, 60 * 60_000);
		if ((result.code ?? 1) !== 0) return `CI/checks failed.\n\n${formatExec(result)}`;
		return undefined;
	};

	const hasReviewComments = async (ctx: ExtensionContext): Promise<boolean> => {
		const result = await run("gh pr view --json reviews,comments --jq '([.reviews[]? | select(.state == \"CHANGES_REQUESTED\" or .state == \"COMMENTED\")] | length) + ([.comments[]?] | length)'", ctx, 60_000);
		return Number.parseInt((result.stdout ?? "0").trim(), 10) > 0;
	};

	const isApproved = async (ctx: ExtensionContext): Promise<boolean> => {
		const result = await run("gh pr view --json reviews --jq '[.reviews[]? | select(.state == \"APPROVED\")] | length'", ctx, 60_000);
		return Number.parseInt((result.stdout ?? "0").trim(), 10) > 0;
	};

	const mergePr = async (ctx: ExtensionContext): Promise<void> => {
		const result = await run("gh pr merge --merge --delete-branch", ctx, 120_000);
		if ((result.code ?? 1) !== 0) throw new Error(`Failed to merge PR.\n${formatExec(result)}`);
	};

	const completeApproved = async (ctx: ExtensionContext): Promise<string> => {
		if (!state) return "No active ralph-loop.";
		const config = state.config;
		const completionProblem = await ensureCompletion(ctx, config);
		if (completionProblem) {
			state = { ...state, phase: "waiting-for-main" };
			persist();
			sendFollowUp(`ralph-loop completion check failed. Fix this and continue:\n\n${completionProblem}`);
			return completionProblem;
		}

		const pr = await ensurePrOrRequestAgent(ctx, config);
		if (pr.pending) return "ralph-loop requested the main agent to create the PR.";
		const prUrl = pr.url;
		if (prUrl) state = { ...state, lastPrUrl: prUrl };
		const mergeCondition = safeMergeCondition(config.completion, config.mergeCondition);
		if (mergeCondition === "none") {
			state = { ...state, active: false, phase: "done" };
			persist();
			return `ralph-loop completed${prUrl ? `: ${prUrl}` : "."}`;
		}
		if (mergeCondition === "always") {
			await mergePr(ctx);
		} else if (mergeCondition === "ci-passed") {
			const ciProblem = await waitForCi(ctx);
			if (ciProblem) {
				state = { ...state, phase: "waiting-for-main" };
				persist();
				sendFollowUp(`ralph-loop CI failed. Review is skipped for this retry. Fix and continue:\n\n${ciProblem}`);
				return ciProblem;
			}
			await mergePr(ctx);
		} else if (mergeCondition === "review-fixed") {
			const ciProblem = await waitForCi(ctx);
			if (ciProblem) {
				state = { ...state, phase: "waiting-for-main" };
				persist();
				sendFollowUp(`ralph-loop CI failed. Review is skipped for this retry. Fix and continue:\n\n${ciProblem}`);
				return ciProblem;
			}
			if (await hasReviewComments(ctx)) {
				state = { ...state, phase: "waiting-for-main" };
				persist();
				sendFollowUp("ralph-loop found PR review comments/change requests. Address them, then continue.");
				return "PR review comments found; main session resumed.";
			}
			await mergePr(ctx);
		} else if (mergeCondition === "approved") {
			for (;;) {
				if (ctx.signal?.aborted) throw new Error("Aborted while waiting for PR approval.");
				if (await isApproved(ctx)) break;
				await new Promise((resolve) => setTimeout(resolve, 60_000));
			}
			await mergePr(ctx);
		}
		state = { ...state, active: false, phase: "done" };
		persist();
		return `ralph-loop completed and merged${prUrl ? `: ${prUrl}` : "."}`;
	};

	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.setStatus("ralph-loop", undefined);
		for (const entry of ctx.sessionManager.getBranch() as any[]) {
			if (entry.type === "custom" && entry.customType === "ralph-loop-state" && entry.data?.active) state = entry.data;
		}
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (!state?.active || running) return;
		if (state.phase !== "waiting-for-main" && state.phase !== "pr-requested") return;
		ctx.ui.setStatus("ralph-loop", undefined);
		running = true;
		try {
			if (state.phase === "pr-requested") {
				const message = await completeApproved(ctx);
				ctx.ui.notify(message, "info");
				return;
			}
			const max = state.config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
			if (state.iteration >= max) {
				state = { ...state, active: false, phase: "done" };
				persist();
				ctx.ui.notify(`ralph-loop stopped after maxIterations=${max}`, "error");
				return;
			}
			state = { ...state, iteration: state.iteration + 1 };
			persist();
			ctx.ui.setStatus("ralph-loop", "running static checks...");
			const staticProblem = await runStaticChecks(ctx, state.config);
			ctx.ui.setStatus("ralph-loop", undefined);
			if (staticProblem) {
				state = { ...state, phase: "waiting-for-main" };
				persist();
				sendFollowUp(`ralph-loop static checks failed. Review will not run until checks pass. Fix the issues and continue.\n\n${staticProblem}`);
				return;
			}
			const checks = state.config.staticChecks ?? [];
			pi.sendMessage({
				customType: "ralph-loop-status",
				content: checks.length > 0
					? `ralph-loop static checks passed (${checks.length}):\n${checks.map((command) => `- ${command}`).join("\n")}\n\nStarting reviewer subagent...`
					: "ralph-loop static checks skipped: no staticChecks configured. Starting reviewer subagent...",
				display: true,
			});
			state = { ...state, phase: "review-requested" };
			persist();
			const decision = await runReviewerSubagent(ctx, state.config);
			if (!decision.approved) {
				state = { ...state, phase: "waiting-for-main" };
				persist();
				sendFollowUp(`ralph-loop reviewer rejected the changes. Fix the following and continue:\n\n${decision.feedback}`);
				return;
			}
			state = { ...state, phase: "approved" };
			persist();
			const message = await completeApproved(ctx);
			ctx.ui.notify(message, "info");
		} finally {
			running = false;
		}
	});

	pi.registerTool({
		name: "ralph-loop",
		label: "Ralph Loop",
		description: "Start an autonomous quality loop for the current task. acceptanceCriteria must accurately and faithfully describe the requirements the user requested. Only specify non-safe options when the user explicitly requested them. Defaults are safe: completion=only-edit, mergeCondition=none, no static checks. PR creation and merging are allowed only when the user explicitly instructed those exact outcomes.",
		promptSnippet: "Start a review/static-check/PR automation loop for the current task when explicitly requested.",
		promptGuidelines: [
			"Use ralph-loop only when the user explicitly asks to run an autonomous review/check/PR loop.",
			"For ralph-loop, specify completion=pr or draft-pr only when the user explicitly asked to create a PR; specify mergeCondition other than none only when the user explicitly asked for that merge behavior.",
		],
		parameters: {
			type: "object",
			properties: {
				staticChecks: { type: "array", items: { type: "string" }, description: "Commands to run after each main-agent completion. Specify only checks the user explicitly requested or project-standard checks you are certain should run." },
				completion: { type: "string", enum: ["only-edit", "commit", "pr", "draft-pr"], description: "Completion action. Default only-edit. Use commit/pr/draft-pr only when explicitly requested." },
				mergeCondition: { type: "string", enum: ["none", "always", "ci-passed", "review-fixed", "approved"], description: "PR merge automation. Default none. Use non-none only when explicitly requested." },
				acceptanceCriteria: { type: "string", description: "Accurately and faithfully describe the requirements requested by the user. Do not invent extra criteria; preserve the user's intent so the reviewer can validate against the real request." },
				maxIterations: { type: "integer", minimum: 1, maximum: 50, description: "Safety cap for automatic retry iterations. Default 25." },
			},
			required: ["acceptanceCriteria"],
			additionalProperties: false,
		},
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const input = params as Partial<Config> & { acceptanceCriteria: string };
			const completion: Completion = input.completion ?? "only-edit";
			const mergeCondition = safeMergeCondition(completion, input.mergeCondition ?? "none");
			state = {
				active: true,
				phase: "waiting-for-main",
				iteration: 0,
				config: {
					staticChecks: input.staticChecks ?? [],
					completion,
					mergeCondition,
					acceptanceCriteria: input.acceptanceCriteria,
					maxIterations: input.maxIterations,
				},
			};
			persist();
			return {
				content: [{ type: "text", text: `ralph-loop started. It will run after this session turn ends. completion=${completion}, mergeCondition=${mergeCondition}.` }],
				details: { state },
			};
		},
	});

	pi.registerTool({
		name: "ralph-loop-decision",
		label: "Ralph Loop Decision",
		description: "Record the reviewer subagent decision for an active ralph-loop. Call this exactly once after reviewer subagent output is available.",
		parameters: {
			type: "object",
			properties: {
				approved: { type: "boolean", description: "true only if reviewer subagent approved the work and all ralph-loop criteria are met" },
				feedback: { type: "string", description: "Required concrete fix instructions when approved=false" },
			},
			required: ["approved"],
			additionalProperties: false,
		},
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!state?.active) return { content: [{ type: "text", text: "No active ralph-loop." }], details: { state } };
			if (state.phase !== "review-requested") {
				return { content: [{ type: "text", text: `ralph-loop-decision ignored because phase=${state.phase}; wait for a reviewer request.` }], details: { state } };
			}
			if (!params.approved) {
				state = { ...state, phase: "waiting-for-main" };
				persist();
				sendFollowUp(`ralph-loop reviewer rejected the changes. Fix the following and continue:\n\n${params.feedback ?? "Reviewer rejected the work but did not provide feedback. Re-check requirements and code quality."}`);
				return { content: [{ type: "text", text: "ralph-loop rejected; main session resumed." }], details: { state } };
			}
			state = { ...state, phase: "approved" };
			persist();
			const message = await completeApproved(ctx);
			return { content: [{ type: "text", text: message }], details: { state } };
		},
	});
}
