// Gives the agent a `compact` tool to compact its own context and keep working.
// Pi's ctx.compact() aborts a running agent first, so the tool only records the
// request and ends the turn. The compaction runs once the run settles, and a
// user message carrying `resume` starts the next run.
// Mirrors the Claude Code plugin ~/.claude/local-plugins/self-compact under the same tool name.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const TOOL = "mcp__self-compact__compact";

const DESCRIPTION = [
	"Compact your own conversation context to free space and keep working.",
	"End your turn right after calling this tool; the compaction runs once the run settles.",
	"`resume` is then sent to you as the next prompt: put in it what you need to continue the task.",
].join(" ");

type Request = { readonly instructions: string | undefined; readonly resume: string };

type Outcome = { readonly kind: "compacted" } | { readonly kind: "failed"; readonly reason: string };

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

// Print and JSON modes exit once the run settles, so no next run could carry `resume`
const canResume = (ctx: ExtensionContext): boolean => ctx.mode === "tui" || ctx.mode === "rpc";

// Decides the prompt that starts the next run from how the compaction ended
const followUp = (outcome: Outcome, resume: string): string => {
	switch (outcome.kind) {
		case "compacted":
			return resume;
		case "failed":
			return `The context compaction failed: ${outcome.reason}\n\n${resume}`;
	}
};

const text = (value: string) => [{ type: "text" as const, text: value }];

export default function selfCompactExtension(pi: ExtensionAPI) {
	// The request recorded by the tool call, consumed when the run settles
	let pending: Request | null = null;

	pi.registerTool({
		name: TOOL,
		label: "Self Compact",
		description: DESCRIPTION,
		// Without a snippet, Pi leaves the tool out of the system prompt's tool list
		promptSnippet: "Compact your own context when it grows large, then continue the task from `resume`.",
		parameters: {
			type: "object",
			properties: {
				instructions: { type: "string", description: "What the summary must keep or drop" },
				resume: { type: "string", description: "The prompt to continue with after the compaction" },
			},
			required: ["resume"],
			additionalProperties: false,
		},
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!canResume(ctx)) {
				return { content: text("Not scheduled: compaction needs an interactive session to resume in."), details: undefined };
			}
			if (!isNonEmptyString(params.resume)) {
				return { content: text("Not scheduled: pass `resume`, the prompt to continue with after the compaction."), details: undefined };
			}
			pending = { instructions: isNonEmptyString(params.instructions) ? params.instructions : undefined, resume: params.resume };
			return {
				content: text("Compaction scheduled. End your turn now; `resume` starts the next turn after the compaction."),
				details: undefined,
				// Ends the turn only when every tool in this batch terminates; otherwise the run settles later
				terminate: true,
			};
		},
	});

	// agent_settled fires once no retry, compaction, or queued continuation will run, so compacting cannot abort work
	pi.on("agent_settled", async (_event, ctx) => {
		if (pending === null) return;
		const request = pending;
		pending = null;
		const resumeWith = (outcome: Outcome) => pi.sendUserMessage(followUp(outcome, request.resume));
		ctx.compact({
			...(request.instructions === undefined ? {} : { customInstructions: request.instructions }),
			onComplete: () => resumeWith({ kind: "compacted" }),
			onError: (error) => resumeWith({ kind: "failed", reason: error.message }),
		});
	});
}
