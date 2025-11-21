---
name: article-writing
description: 箇条書きコンテンツを技術記事に仕上げる際に使用する。自然な文体とスタイルで執筆するためのガイドライン。
---

## Purpose

Transform technical bullet-point content into natural, readable articles that avoid AI-generated writing patterns while maintaining technical accuracy.

## Writing Guidelines

<natural_writing>
### 自然な文体の特徴

**基本方針**: AIが生成した文章特有の機械的・形式的な印象を避け、人が書いたような自然な技術記事を目指す。

**文体**:
- です・ます調を基本とする
- カジュアルで親しみやすいトーン
- 適度に一人称（「私は」「個人的には」）を使用
- 「〜してみました」「〜と思います」「〜が便利です」などの個人的な表現を含める

**段落構成**:
- 短めの段落を心がける
- 1段落1トピックを基本とする
- 段落間の接続は自然な流れを意識（「さて、」「ところで、」「そんな中、」など）
- 適度な改行で読みやすさを確保
</natural_writing>

<avoid_ai_like_patterns>
### AIっぽい表現を避けるための具体策

**見出しの番号付けを避ける**:
- ❌ `## 1. はじめに`
- ❌ `## 2. 実装方法`
- ✅ `## はじめに`
- ✅ `## 実装方法`

**リストの使い方**:
- 箇条書き（-）を優先、番号付きリスト（1. 2. 3.）は本当に順序が重要な場合のみ使用
- ❌ 多用しすぎる番号付きリスト
- ✅ 適度な箇条書きと説明的な段落のバランス

**手順書的な表現を避ける**:
- ❌ 「まず、〜を実行します。次に、〜を設定します。最後に、〜を確認します。」
- ✅ 「〜を実行してから、〜を設定します。これで〜が確認できるようになります。」

**形式的すぎる表現を避ける**:
- ❌ 「実施する」「確認する」「〜することができます」
- ✅ 「やる」「試す」「見てみる」「〜できます」

**結論を押し付けない**:
- ❌ 「これにより、明らかに〜が向上します」
- ✅ 「〜が改善されると感じています」「〜という効果がありそうです」
</avoid_ai_like_patterns>

<article_structure>
### 記事構成のパターン

**導入**: 背景や問題提起、個人的な動機から始める

**本文**: h2/h3 で構造化（見出しに番号なし）、説明と具体例のバランス

**まとめ**: 要点を再説し、読者への呼びかけや次のステップを提案
</article_structure>

<content_balance>
### コンテンツのバランス

- 箇条書きと説明的な段落を組み合わせる
- 具体例とユースケースを含める（「なぜそうしたのか」も説明）
- 技術的事実は客観的に、感想や評価は個人的視点で
- 断定しすぎず適度な不確実性を残す（「〜かもしれません」「〜だと考えられます」）
</content_balance>

<code_blocks>
### コードブロックの扱い

- 言語を適切に指定（```typescript, ```bash, ```json など）
- 必要に応じてファイル名をタイトルとして追加（```typescript:src/config.ts）
- 本文でコードの説明を含める（コメントだけに頼らない）
- 長いコードは抜粋のみ掲載
</code_blocks>

## Reference Articles

**CRITICAL**: Before writing ANY article, you MUST read ALL 4 reference articles below.

文体は言語化では完全に捉えられません。必ず4つすべての実際の記事を読んで、その流れ、表現、リズムを学習してください。

Use the Skill tool to view ALL reference articles:
```
view(skill='skills/article-writing/examples/sample-article-1.md')
view(skill='skills/article-writing/examples/sample-article-2.md')
view(skill='skills/article-writing/examples/sample-article-3.md')
view(skill='skills/article-writing/examples/sample-article-4.md')
```

When reading the sample articles, pay attention to:
- Natural paragraph transitions ("さて、", "で、", "そんな中、", "という感じで、", "といったことがありました")
- Personal voice and casual expressions ("〜してみました", "〜だったりします", "〜ですね", "〜が便利です")
- When the author uses lists vs. narrative paragraphs
- How code blocks are introduced and explained naturally
- The conversational flow from introduction to conclusion
- Personal anecdotes and motivations ("退屈な開発をサボりたくて", "かくいう私も")
