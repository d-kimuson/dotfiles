#!/usr/bin/env node
/**
 * language-guard hook for Claude Code
 *
 * モデルの応答テキストが英語・中国語へドリフトするのを防ぐ。thinking は対象外。
 *
 * - UserPromptSubmit: 日本語で応答するリマインダーを additionalContext に添える (予防)
 * - PostToolUse: ツール呼び出しに添えた途中経過のテキストがドリフトしていたら注意を差し込む
 * - Stop: 最終応答がドリフトしていたら 1 回だけ停止を取り消し、日本語で書き直させる
 *
 * 判定ロジックは pi extension と共有する ./detect.mts にある。
 *
 * ソース: chezmoi/dot_claude/hooks/language-guard/executable_hook.mts
 * 配布先: ~/.claude/hooks/language-guard/hook.mts (chezmoi)
 * 登録: config/claude-settings.json の hooks
 */

import { closeSync, fstatSync, openSync, readFileSync, readSync } from "node:fs";
import { LANGUAGE_REMINDER, decideAction, isLanguageOverrideRequested } from "./detect.mts";

type HookInput = {
	readonly hook_event_name?: string;
	readonly transcript_path?: string;
	readonly prompt?: string;
	readonly stop_hook_active?: boolean;
	readonly last_assistant_message?: string;
	readonly tool_use_id?: string;
};

type ContentBlock = {
	readonly type?: string;
	readonly text?: string;
	readonly id?: string;
};

type TranscriptEntry = {
	readonly type?: string;
	readonly isMeta?: boolean;
	readonly message?: {
		readonly id?: string;
		readonly content?: string | readonly ContentBlock[];
	};
};

/** transcript は長くなるので末尾だけ読む。直近のターンを辿れれば足りる */
const TRANSCRIPT_TAIL_BYTES = 4 * 1024 * 1024;

function readTranscriptTail(path: string | undefined): readonly TranscriptEntry[] {
	if (path === undefined || path.length === 0) return [];
	let fd: number | undefined;
	try {
		fd = openSync(path, "r");
		const size = fstatSync(fd).size;
		const length = Math.min(size, TRANSCRIPT_TAIL_BYTES);
		const buffer = Buffer.alloc(length);
		readSync(fd, buffer, 0, length, size - length);
		const lines = buffer.toString("utf8").split("\n");
		// 途中から読んだ場合、先頭行は欠けているので捨てる
		if (length < size) lines.shift();
		return lines.flatMap((line) => {
			if (line.trim() === "") return [];
			try {
				return [JSON.parse(line) as TranscriptEntry];
			} catch {
				return [];
			}
		});
	} catch {
		return [];
	} finally {
		if (fd !== undefined) closeSync(fd);
	}
}

function blocksOf(entry: TranscriptEntry): readonly ContentBlock[] {
	const content = entry.message?.content;
	if (content === undefined) return [];
	return typeof content === "string" ? [{ type: "text", text: content }] : content;
}

function textOf(blocks: readonly ContentBlock[]): string {
	return blocks
		.filter((block) => block.type === "text" && typeof block.text === "string")
		.map((block) => block.text)
		.join("\n");
}

/** ツール結果やメタ情報ではない、ユーザーが実際に入力した最後のプロンプト */
function lastUserPrompt(entries: readonly TranscriptEntry[]): string | undefined {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry === undefined || entry.type !== "user" || entry.isMeta === true) continue;
		const blocks = blocksOf(entry);
		if (blocks.some((block) => block.type === "tool_result")) continue;
		return textOf(blocks);
	}
	return undefined;
}

function lastAssistantText(entries: readonly TranscriptEntry[]): string {
	const last = entries.findLast((entry) => entry.type === "assistant");
	const messageId = last?.message?.id;
	if (messageId === undefined) return "";
	return textOf(entries.filter((entry) => entry.message?.id === messageId).flatMap(blocksOf));
}

/**
 * tool_use を含む assistant メッセージのテキストを返す。
 * 並列ツール呼び出しで同じ注意を繰り返さないよう、そのメッセージの最初の tool_use のときだけ返す。
 */
function textBeforeFirstToolUse(entries: readonly TranscriptEntry[], toolUseId: string): string | undefined {
	const owner = entries.find(
		(entry) => entry.type === "assistant" && blocksOf(entry).some((block) => block.type === "tool_use" && block.id === toolUseId),
	);
	const messageId = owner?.message?.id;
	if (messageId === undefined) return undefined;
	const blocks = entries.filter((entry) => entry.type === "assistant" && entry.message?.id === messageId).flatMap(blocksOf);
	const firstToolUse = blocks.find((block) => block.type === "tool_use");
	if (firstToolUse?.id !== toolUseId) return undefined;
	return textOf(blocks);
}

function emit(output: unknown): void {
	process.stdout.write(`${JSON.stringify(output)}\n`);
}

function handleUserPromptSubmit(input: HookInput): void {
	if (isLanguageOverrideRequested(input.prompt)) return;
	emit({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: LANGUAGE_REMINDER } });
}

function handlePostToolUse(input: HookInput): void {
	if (input.tool_use_id === undefined) return;
	const entries = readTranscriptTail(input.transcript_path);
	const text = textBeforeFirstToolUse(entries, input.tool_use_id);
	if (text === undefined) return;
	const action = decideAction({ text, phase: "intermediate", lastUserPrompt: lastUserPrompt(entries), alreadyRewritten: false });
	if (action.kind !== "nudge") return;
	emit({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: action.message } });
}

function handleStop(input: HookInput): void {
	const entries = readTranscriptTail(input.transcript_path);
	const action = decideAction({
		text: input.last_assistant_message ?? lastAssistantText(entries),
		phase: "final",
		lastUserPrompt: lastUserPrompt(entries),
		alreadyRewritten: input.stop_hook_active === true,
	});
	if (action.kind !== "rewrite") return;
	emit({ decision: "block", reason: action.message });
}

function main(): void {
	let input: HookInput;
	try {
		input = JSON.parse(readFileSync(0, "utf8")) as HookInput;
	} catch {
		return;
	}
	switch (input.hook_event_name) {
		case "UserPromptSubmit":
			handleUserPromptSubmit(input);
			return;
		case "PostToolUse":
			handlePostToolUse(input);
			return;
		case "Stop":
			handleStop(input);
			return;
		default:
			return;
	}
}

// hook の失敗でエージェントを止めない
try {
	main();
} catch {
	// noop
}
