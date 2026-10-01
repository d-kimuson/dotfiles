/**
 * Tests for the language-guard core shared by the Claude Code hook
 * (~/.claude/hooks/language-guard/) and the pi extension
 * (~/.pi/agent/extensions/language-guard/, which symlinks detect.mts).
 *
 * Only the user-facing text is judged; thinking is out of scope.
 */

import { describe, it, expect } from "vitest"
import {
  classifySegment,
  decideAction,
  evaluateResponse,
  isLanguageOverrideRequested,
  stripNonProse,
} from "../../../chezmoi/dot_claude/hooks/language-guard/detect.mts"

describe("stripNonProse", () => {
  it("removes fenced code blocks, inline code, URLs and paths", () => {
    const text = [
      "設定を変更しました。",
      "```ts",
      "const message = 'this is an English sentence inside code'",
      "```",
      "See `some English identifier here` at https://example.com/docs and chezmoi/dot_claude/hooks/foo.ts",
    ].join("\n")
    const stripped = stripNonProse(text)
    expect(stripped).not.toContain("English sentence")
    expect(stripped).not.toContain("identifier")
    expect(stripped).not.toContain("example.com")
    expect(stripped).not.toContain("dot_claude")
    expect(stripped).toContain("設定を変更しました。")
  })

  it("removes table rows and blockquotes", () => {
    const text = ["| Name | Description of the column |", "|---|---|", "> Quoted English error message from the tool output"].join("\n")
    expect(stripNonProse(text).trim()).toBe("")
  })
})

describe("classifySegment", () => {
  it("classifies Japanese with kana as ja", () => {
    expect(classifySegment("Claude Code の Stop hook で応答を検査します。")).toBe("ja")
  })

  it("classifies a kana-less Han sentence with Chinese markers as zh", () => {
    expect(classifySegment("我已经完成了这个配置文件的修改。")).toBe("zh")
    expect(classifySegment("这个问题怎么办")).toBe("zh")
  })

  it("does not treat short kanji-only Japanese headings as zh", () => {
    expect(classifySegment("## 実装方針")).toBe("neutral")
    expect(classifySegment("変更内容")).toBe("neutral")
  })

  it("classifies English prose as en", () => {
    expect(classifySegment("I have updated the configuration file and verified the result.")).toBe("en")
  })

  it("treats short English fragments as neutral", () => {
    expect(classifySegment("Done.")).toBe("neutral")
    expect(classifySegment("- Stop hook")).toBe("neutral")
  })
})

describe("evaluateResponse", () => {
  it("accepts a Japanese response", () => {
    const text = "変更を反映しました。\n\n- `config/claude-settings.json` に hook を追加\n- テストはすべて成功しています。"
    expect(evaluateResponse(text)).toEqual({ kind: "ok" })
  })

  it("accepts a Japanese response with English inside code blocks", () => {
    const text = [
      "エラーは以下の通りです。",
      "```",
      "Error: Cannot find module 'foo'. Please make sure the package is installed and try again.",
      "```",
      "パッケージを追加すれば解消します。",
    ].join("\n")
    expect(evaluateResponse(text)).toEqual({ kind: "ok" })
  })

  it("flags a fully English response", () => {
    const text =
      "I've updated the hook configuration.\n\nThe Stop hook now inspects the last assistant message and blocks when the response is not written in Japanese."
    expect(evaluateResponse(text)).toMatchObject({ kind: "violation", detected: "en" })
  })

  it("flags a response that drifts from Japanese into English", () => {
    const text = [
      "設定を確認しました。",
      "Next, I will update the extension so that it checks the final assistant message. After that, I'll run the tests to make sure everything passes.",
    ].join("\n\n")
    expect(evaluateResponse(text)).toMatchObject({ kind: "violation", detected: "en" })
  })

  it("accepts a short English quote within a mostly Japanese response", () => {
    const text = [
      "hook の追加と配布が完了し、動作確認まで終わりました。",
      "Claude Code と pi の両方で、日本語以外の応答を検知すると一度だけ書き直しを促します。",
      "Build succeeded without warnings.",
      "引き続き問題があれば教えてください。",
    ].join("\n\n")
    expect(evaluateResponse(text)).toEqual({ kind: "ok" })
  })

  it("accepts a Japanese report that lists English commit subjects", () => {
    const text = [
      "`main` に2つに分けてコミットしました。push はまだしていません。",
      "",
      "- `26a38be` style(sample): join the catalog's language and theme controls in one pill",
      "- `89fe8cd` style(sample): label the catalog thumbnails with the elements each sample uses",
      "",
      "言語・テーマのピル化と、サムネ上のラベル化は、別々に戻せる単位にしてあります。",
    ].join("\n")
    expect(evaluateResponse(text)).toEqual({ kind: "ok" })
  })

  it("accepts a Japanese report that lists several English commit subjects", () => {
    const text = [
      "`main` に4つに分けてコミットしました。",
      "",
      "- `26a38be` style(sample): join the catalog's language and theme controls in one pill",
      "- `89fe8cd` style(sample): label the catalog thumbnails with the elements each sample uses",
      "- `1b2c3d4` fix(sample): keep the selected theme when switching the catalog language",
      "- `5e6f7a8` docs(sample): describe how the catalog thumbnails are generated from samples",
      "",
      "それぞれ別々に戻せる単位にしてあります。",
    ].join("\n")
    expect(evaluateResponse(text)).toEqual({ kind: "ok" })
  })

  it("still flags a fully English bulleted report", () => {
    const text = [
      "- I updated the hook configuration so that the Stop event is handled correctly.",
      "- I also ran the whole test suite and confirmed that every test passes now.",
    ].join("\n")
    expect(evaluateResponse(text)).toMatchObject({ kind: "violation", detected: "en" })
  })

  it("flags a response that drifts into Chinese mid-paragraph", () => {
    const text = "設定を確認しました。我已经完成了这个配置文件的修改，现在可以运行测试了。"
    expect(evaluateResponse(text)).toMatchObject({ kind: "violation", detected: "zh" })
  })

  it("accepts an empty or code-only response", () => {
    expect(evaluateResponse("")).toEqual({ kind: "ok" })
    expect(evaluateResponse("```sh\nnpm run build && npm test -- --watch=false\n```")).toEqual({ kind: "ok" })
  })
})

describe("isLanguageOverrideRequested", () => {
  it("detects explicit requests for another language", () => {
    expect(isLanguageOverrideRequested("この文章を英訳して")).toBe(true)
    expect(isLanguageOverrideRequested("英語で返して")).toBe(true)
    expect(isLanguageOverrideRequested("reply in English please")).toBe(true)
    expect(isLanguageOverrideRequested("中国語に翻訳して")).toBe(true)
    expect(isLanguageOverrideRequested("translate this into English")).toBe(true)
  })

  it("does not trigger when English is only the source, not the requested output", () => {
    expect(isLanguageOverrideRequested("このEnglishのエラーメッセージを日本語に訳して")).toBe(false)
    expect(isLanguageOverrideRequested("英語で書かれたドキュメントを要約して")).toBe(false)
    expect(isLanguageOverrideRequested("この README を翻訳して")).toBe(false)
    expect(isLanguageOverrideRequested("Chinese のログが混ざっている原因を調べて")).toBe(false)
  })

  it("does not trigger for ordinary prompts", () => {
    expect(isLanguageOverrideRequested("hook を追加して")).toBe(false)
    expect(isLanguageOverrideRequested(undefined)).toBe(false)
  })
})

describe("decideAction", () => {
  const english = "I have updated the configuration file and verified that every test passes."
  const japanese = "設定ファイルを更新し、すべてのテストが通ることを確認しました。"

  it("does nothing for Japanese text", () => {
    expect(decideAction({ text: japanese, phase: "final", lastUserPrompt: "直して", alreadyRewritten: false })).toEqual({ kind: "none" })
  })

  it("asks for a rewrite when the final response drifts", () => {
    const action = decideAction({ text: english, phase: "final", lastUserPrompt: "直して", alreadyRewritten: false })
    expect(action.kind).toBe("rewrite")
    expect(action.kind === "rewrite" && action.message).toContain("書き直してください")
  })

  it("only nudges for intermediate text so the work continues", () => {
    const action = decideAction({ text: english, phase: "intermediate", lastUserPrompt: "直して", alreadyRewritten: false })
    expect(action.kind).toBe("nudge")
    expect(action.kind === "nudge" && action.message).not.toContain("書き直してください")
  })

  it("never asks for a second rewrite in a row", () => {
    expect(decideAction({ text: english, phase: "final", lastUserPrompt: "直して", alreadyRewritten: true })).toEqual({ kind: "none" })
  })

  it("respects an explicit request for another language", () => {
    expect(decideAction({ text: english, phase: "final", lastUserPrompt: "英語で書いて", alreadyRewritten: false })).toEqual({ kind: "none" })
  })
})
