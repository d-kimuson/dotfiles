/**
 * language-guard core
 *
 * モデルの応答本文 (ユーザー向けテキスト) が日本語から英語・中国語へ
 * ドリフトしていないかを判定する純粋関数群。thinking は判定対象外。
 *
 * Claude Code hook (~/.claude/hooks/language-guard/hook.mts) と
 * pi extension (~/.pi/agent/extensions/language-guard/index.ts, detect.mts は symlink)
 * の両方から使う。Node の type stripping でそのまま実行できるよう、
 * enum など消去不能な TS 構文は使わない。
 *
 * ソース: chezmoi/dot_claude/hooks/language-guard/detect.mts
 * テスト: internal/src/language-guard/
 */

export type SegmentLanguage = "ja" | "en" | "zh" | "neutral";
export type DriftLanguage = "en" | "zh";

export type Verdict =
	| { readonly kind: "ok" }
	| { readonly kind: "violation"; readonly detected: DriftLanguage; readonly excerpt: string };

const KANA = /[ぁ-ゖァ-ヺーｦ-ﾟ]/gu;
const HAN = /\p{Script=Han}/gu;
const LATIN_WORD = /[A-Za-z]{2,}(?:'[A-Za-z]+)?/g;
/** 簡体字・繁体字のうち日本語ではまず使わない字。kana なしの漢字列を中国語と判定する根拠にする */
const CHINESE_ONLY = /[这们吗呢么说还对个为问题发现过让经时实给从应该样请关键测试运這說還們嗎麼讓發經]/gu;

/** 語数がこれ以上の英語行が、散文中で閾値以上の比率を占めたら英語ドリフトとみなす */
const EN_MIN_WORDS_PER_LINE = 8;
const EN_MIN_SHARE = 0.6;
/** 日本語は同じ情報量を英語の約半分の文字数で書けるため、比率計算では重みを付ける */
const NON_EN_CHAR_WEIGHT = 2;
/**
 * 箇条書きの英語行 (コミットメッセージやエラー名の列挙など) は日本語の報告にも混ざりやすいので軽く数える。
 * 全文が英語なら比率は 1 のままなので、完全なドリフトの検出には影響しない
 */
const EN_LIST_ITEM_WEIGHT = 0.25;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s/;
/** kana なしの漢字列がこれ以上なら、中国語固有字がなくても中国語とみなす */
const ZH_MIN_HAN_WITHOUT_MARKER = 12;
const ZH_MIN_HAN_WITH_MARKER = 4;

/** 出力言語としての指定だけを拾う。「英語で書かれた〜」のように入力側を指す言い回しは除く */
const OVERRIDE_REQUEST = /英訳|中訳|(?:英語|英文|中国語|中文)(?:で|に)(?!書かれ)|\b(?:in|into|to) (?:english|chinese)\b/i;
/** 「English のエラーを日本語に訳して」のように日本語での出力を求めている場合は上書きしない */
const JAPANESE_TARGET = /日本語(?:で|に)|和訳|\b(?:in|into|to) japanese\b/i;

function count(text: string, pattern: RegExp): number {
	return text.match(pattern)?.length ?? 0;
}

/**
 * 言語判定に関係しない部分 (コード、URL、パス、識別子、表、引用) を取り除く。
 * ツール出力の引用やコード中の英語で誤検知しないための前処理。
 */
export function stripNonProse(text: string): string {
	return text
		.replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[^\n]*$/gm, "")
		.replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*$/m, "")
		.replace(/`[^`\n]*`/g, " ")
		.replace(/\bhttps?:\/\/\S+/g, " ")
		.replace(/<[^>\n]+>/g, " ")
		.split("\n")
		.filter((line) => !/^\s*[|>]/.test(line))
		.join("\n")
		.replace(/[^\s()（）「」『』、。，]*[_/\\=@#$<>{}[\]][^\s()（）「」『』、。，]*/g, " ")
		.replace(/\b[a-z]+[A-Z]\w*\b/g, " ")
		.replace(/\b\w+\.\w+\b/g, " ");
}

/** 1 行または 1 文の言語を判定する。日本語は必ず仮名を含む、という性質に依拠する */
export function classifySegment(segment: string): SegmentLanguage {
	const kana = count(segment, KANA);
	if (kana > 0) return "ja";

	const han = count(segment, HAN);
	const markers = count(segment, CHINESE_ONLY);
	if (han >= ZH_MIN_HAN_WITHOUT_MARKER || (han >= ZH_MIN_HAN_WITH_MARKER && markers > 0)) return "zh";

	if (count(segment, LATIN_WORD) >= EN_MIN_WORDS_PER_LINE) return "en";
	return "neutral";
}

function excerptOf(segment: string): string {
	const trimmed = segment.trim();
	return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
}

/** 中国語は文単位で 1 つでもあれば違反 (日本語の途中で混ざるケースを拾う) */
function findChinese(prose: string): string | undefined {
	return prose.split(/[。！？!?\n，]/).find((sentence) => classifySegment(sentence) === "zh");
}

/** 英語は行単位で集計し、散文の中で一定以上を占めたときだけ違反にする */
function findEnglish(prose: string): string | undefined {
	const lines = prose
		.split("\n")
		.map((line) => ({ line, language: classifySegment(line) }))
		.filter(({ language }) => language !== "neutral");
	const english = lines.filter(({ language }) => language === "en");
	if (english.length === 0) return undefined;

	const weightOf = ({ line, language }: { line: string; language: SegmentLanguage }): number => {
		if (language !== "en") return line.trim().length * NON_EN_CHAR_WEIGHT;
		return line.trim().length * (LIST_ITEM.test(line) ? EN_LIST_ITEM_WEIGHT : 1);
	};
	const proseChars = lines.reduce((sum, line) => sum + weightOf(line), 0);
	const englishChars = english.reduce((sum, line) => sum + weightOf(line), 0);
	if (englishChars / proseChars < EN_MIN_SHARE) return undefined;
	return english[0]?.line;
}

export function evaluateResponse(text: string): Verdict {
	const prose = stripNonProse(text);

	const chinese = findChinese(prose);
	if (chinese !== undefined) return { kind: "violation", detected: "zh", excerpt: excerptOf(chinese) };

	const english = findEnglish(prose);
	if (english !== undefined) return { kind: "violation", detected: "en", excerpt: excerptOf(english) };

	return { kind: "ok" };
}

/** ユーザーが明示的に他言語での出力や翻訳を頼んだターンは検査しない */
export function isLanguageOverrideRequested(prompt: string | undefined): boolean {
	return prompt !== undefined && OVERRIDE_REQUEST.test(prompt) && !JAPANESE_TARGET.test(prompt);
}

/** 毎ターンのユーザー入力に添える予防用リマインダー */
export const LANGUAGE_REMINDER =
	"Reply to the user in Japanese (日本語). Do not switch to English or Chinese for the user-facing text, even when tool output or sources are in another language. Code, identifiers, commands, and quoted text may stay as-is. Thinking may be in any language.";

const LANGUAGE_NAMES: Record<DriftLanguage, string> = { en: "英語", zh: "中国語" };

/** final: ターン最後の応答 / intermediate: ツール呼び出しに添えた途中経過のテキスト */
export type TextPhase = "intermediate" | "final";

export type GuardInput = {
	readonly text: string;
	readonly phase: TextPhase;
	readonly lastUserPrompt: string | undefined;
	/** 直前に書き直しを要求済みか。書き直しの連鎖でループさせないためのガード */
	readonly alreadyRewritten: boolean;
};

export type GuardAction =
	| { readonly kind: "none" }
	/** 作業は止めず、次のリクエストに注意だけ差し込む */
	| { readonly kind: "nudge"; readonly message: string }
	/** 停止を取り消し、同じ内容を日本語で書き直させる (1 回まで) */
	| { readonly kind: "rewrite"; readonly message: string };

function detectedLabel(verdict: Extract<Verdict, { kind: "violation" }>): string {
	return `検出: ${LANGUAGE_NAMES[verdict.detected]}「${verdict.excerpt}」`;
}

export function decideAction(input: GuardInput): GuardAction {
	if (isLanguageOverrideRequested(input.lastUserPrompt)) return { kind: "none" };
	const verdict = evaluateResponse(input.text);
	if (verdict.kind === "ok") return { kind: "none" };

	if (input.phase === "intermediate") {
		return {
			kind: "nudge",
			message: `[language-guard] 直前のテキストが日本語ではありませんでした (${detectedLabel(verdict)})。書き直しは不要なので作業を続け、以降のユーザー向けテキストは日本語で書いてください。`,
		};
	}
	if (input.alreadyRewritten) return { kind: "none" };
	return {
		kind: "rewrite",
		message: [
			`[language-guard] 直前の応答本文が日本語ではありませんでした (${detectedLabel(verdict)})。`,
			"ユーザー向けのテキストは日本語で書くルールです。直前の応答と同じ内容を日本語で書き直してください。",
			"作業のやり直しやツールの再実行は不要です。コード・識別子・コマンド・引用はそのままで構いません。",
		].join("\n"),
	};
}
