/**
 * language-guard Extension
 *
 * モデルの応答テキストが英語・中国語へドリフトするのを防ぐ。thinking は対象外。
 * Claude Code の ~/.claude/hooks/language-guard/hook.mts と同じ判定ロジックを
 * ./detect.mts (Claude Code 側の core への symlink) から使う。
 *
 * - before_agent_start: 日本語で応答するリマインダーを非表示メッセージで添える (予防)
 * - turn_end (ツール呼び出しあり): 途中経過のテキストがドリフトしていたら注意を差し込む
 * - turn_end (最終応答): ドリフトしていたら 1 回だけ追加リクエストで日本語に書き直させる
 *
 * 対話モード (tui / rpc) だけで動かし、subagent などの headless 実行には触らない。
 *
 * ソース: chezmoi/private_dot_pi/private_agent/extensions/language-guard/index.ts
 * 配布先: ~/.pi/agent/extensions/language-guard/index.ts (chezmoi)
 * core: chezmoi/dot_claude/hooks/language-guard/detect.mts
 */

import type {
	ExtensionAPI,
	ExtensionContext,
	SessionBoundaryDraft,
	TurnEndEvent,
	TurnEndEventResult,
} from "@earendil-works/pi-coding-agent";

/** ./detect.mts の公開 API。chezmoi ソース上では symlink_ なので、テストからは注入する */
type LanguageGuardCore = typeof import("./detect.mts");

const CUSTOM_TYPE = "language-guard";
const ACTIVE_MODES: ReadonlySet<string> = new Set(["tui", "rpc"]);

type ContentPart = { readonly type?: string; readonly text?: string };

function assistantParts(event: TurnEndEvent): readonly ContentPart[] | undefined {
	const message = event.message as { role?: string; content?: unknown };
	if (message.role !== "assistant" || !Array.isArray(message.content)) return undefined;
	return message.content as ContentPart[];
}

function textOf(parts: readonly ContentPart[]): string {
	return parts
		.filter((part) => part.type === "text" && typeof part.text === "string")
		.map((part) => part.text)
		.join("\n");
}

function guardMessage(content: string, display: boolean): SessionBoundaryDraft {
	return { type: "custom_message", customType: CUSTOM_TYPE, content, display };
}

export function createLanguageGuard(core: LanguageGuardCore) {
	const { LANGUAGE_REMINDER, decideAction, isLanguageOverrideRequested } = core;
	const isActive = (ctx: ExtensionContext): boolean => ACTIVE_MODES.has(ctx.mode);

	return function languageGuardExtension(pi: ExtensionAPI) {
		let lastUserPrompt: string | undefined;
		/** 書き直しを要求した直後の最終応答は再判定しない (ループ防止) */
		let rewriteRequested = false;

		pi.on("input", (event, ctx) => {
			if (!isActive(ctx) || event.source === "extension") return;
			lastUserPrompt = event.text;
		});

		pi.on("before_agent_start", (event, ctx) => {
			if (!isActive(ctx) || isLanguageOverrideRequested(event.prompt)) return;
			return { message: { customType: CUSTOM_TYPE, content: LANGUAGE_REMINDER, display: false } };
		});

		pi.on("turn_end", (event, ctx): TurnEndEventResult | undefined => {
			if (!isActive(ctx) || event.outcome !== "completed") return;
			const parts = assistantParts(event);
			if (parts === undefined) return;

			const phase = parts.some((part) => part.type === "toolCall") ? "intermediate" : "final";
			const action = decideAction({ text: textOf(parts), phase, lastUserPrompt, alreadyRewritten: rewriteRequested });
			if (phase === "final") rewriteRequested = false;

			switch (action.kind) {
				case "none":
					return;
				case "nudge":
					return { entries: [...event.entries, guardMessage(action.message, false)] };
				case "rewrite":
					// event.context.canContinue は追加前の状態 (最終応答直後は常に false)。
					// 指示メッセージを足した後の継続可否は pi 側が再検証する
					rewriteRequested = true;
					return { entries: [...event.entries, guardMessage(action.message, true)], continue: true };
			}
		});
	};
}

export default async function languageGuardExtension(pi: ExtensionAPI) {
	createLanguageGuard(await import("./detect.mts"))(pi);
}
