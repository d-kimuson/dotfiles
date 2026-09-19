import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Muse Spark 1.3 returns caller-bound encrypted reasoning details through the
 * OpenCode Go gateway. Those details are not safe to replay after a new
 * request, connection, or model switch. Keep the visible reasoning text, but
 * drop the opaque signatures before Pi serializes the conversation.
 */
const isAffectedModel = (ctx: ExtensionContext): boolean => {
	const model = ctx.model;
	return model?.provider === "opencode-go" && model.id.startsWith("muse-spark-1.3");
};

export default function opencodeMuseReasoningExtension(pi: ExtensionAPI): void {
	pi.on("context", (event, ctx) => {
		if (!isAffectedModel(ctx)) return;

		const messages = structuredClone(event.messages);
		for (const message of messages) {
			if (message.role !== "assistant") continue;
			for (const block of message.content) {
				if (block.type === "thinking") delete block.thinkingSignature;
				if (block.type === "toolCall") delete block.thoughtSignature;
			}
		}

		return { messages };
	});
}
