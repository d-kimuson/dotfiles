/**
 * herdr Auto Title Extension
 *
 * pi 版の herdr-auto-title。ユーザーの最初のプロンプトをきっかけに
 * `~/.claude/hooks/herdr-auto-title.py` をバックグラウンドで起動し、
 * 会話内容から短いタイトルを生成して herdr のタブ名に反映する。
 *
 * タイトル生成・ソケット通信・状態管理の実体は Python スクリプト側にあり、
 * この extension は Claude Code の UserPromptSubmit hook 相当として
 * `input` イベントを転送するだけの薄い層である。
 * スクリプトは自前で daemonize するため、ここでは spawn して stdin に
 * hook 入力を流したら待たずに切り離す。エージェントの応答は一切止めない。
 *
 * ソース: chezmoi/private_dot_pi/private_agent/extensions/herdr-auto-title.ts
 * 配布先: ~/.pi/agent/extensions/herdr-auto-title.ts (chezmoi)
 * 本体: chezmoi/dot_claude/hooks/executable_herdr-auto-title.py
 * 上流: https://github.com/sh1ma/herdr-auto-title
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type HookInput = {
	readonly session_id: string;
	readonly transcript_path: string | undefined;
	readonly prompt: string;
	readonly agent: "pi";
};

type InputLike = {
	readonly text: string;
	readonly source: string;
};

/**
 * herdr ペインの中で動いているときだけ有効にする。
 * HERDR_SOCKET_PATH などが無ければスクリプト側も何もしないが、
 * プロセス起動自体を避けるためこちらでも閉じる。
 */
function isHerdrPane(env: NodeJS.ProcessEnv = process.env): boolean {
	if (env.HERDR_AUTO_TITLE_DISABLE) return false;
	return (
		env.HERDR_ENV === "1" &&
		typeof env.HERDR_SOCKET_PATH === "string" &&
		env.HERDR_SOCKET_PATH.length > 0 &&
		((typeof env.HERDR_PANE_ID === "string" && env.HERDR_PANE_ID.length > 0) ||
			(typeof env.HERDR_TAB_ID === "string" && env.HERDR_TAB_ID.length > 0))
	);
}

function resolveScript(homeDir: string = homedir()): string | undefined {
	const candidate = join(homeDir, ".claude", "hooks", "herdr-auto-title.py");
	return existsSync(candidate) ? candidate : undefined;
}

function sessionIdOf(ctx: ExtensionContext): string {
	try {
		const id = ctx.sessionManager.getSessionId();
		if (typeof id === "string" && id.length > 0) return id;
	} catch {
		// 未保存セッションなどで取れない場合は unknown に倒す
	}
	return "unknown";
}

function sessionFileOf(ctx: ExtensionContext): string | undefined {
	try {
		const file = ctx.sessionManager.getSessionFile();
		return typeof file === "string" && file.length > 0 ? file : undefined;
	} catch {
		return undefined;
	}
}

function buildHookInput(ctx: ExtensionContext, text: string): HookInput {
	return {
		session_id: sessionIdOf(ctx),
		transcript_path: sessionFileOf(ctx),
		prompt: text,
		agent: "pi",
	};
}

/**
 * 転送すべき入力かどうか。対話 TUI からの生入力だけを対象にし、
 * headless (print/rpc/json) や extension 経由の注入は触らない。
 */
function shouldHandle(ctx: ExtensionContext, event: InputLike): boolean {
	if (ctx.mode !== "tui") return false;
	if (event.source !== "interactive") return false;
	if (typeof event.text !== "string" || event.text.trim().length === 0) return false;
	return isHerdrPane();
}

function fireHook(script: string, input: HookInput, cwd: string): void {
	let child;
	try {
		child = spawn("python3", [script], {
			detached: true,
			stdio: ["pipe", "ignore", "ignore"],
			cwd,
			env: process.env,
		});
	} catch {
		return;
	}
	// python3 が無い場合などの非同期失敗も握りつぶす (UX を壊さない)
	child.on("error", () => {});
	try {
		child.stdin.write(`${JSON.stringify(input)}\n`);
		child.stdin.end();
	} catch {
		// stdin が既に閉じていても続行できるので無視する
	}
	child.unref();
}

export const __herdrAutoTitleInternals = {
	isHerdrPane,
	resolveScript,
	buildHookInput,
	shouldHandle,
};

export default function herdrAutoTitleExtension(pi: ExtensionAPI) {
	pi.on("input", (event, ctx) => {
		if (!shouldHandle(ctx, event as InputLike)) return;
		const script = resolveScript();
		if (!script) return;
		fireHook(script, buildHookInput(ctx, (event as InputLike).text), ctx.cwd);
	});
}
