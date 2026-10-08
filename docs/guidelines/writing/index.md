# Writing

ドキュメント全般の原則。文書タイプ別のルールとテンプレートは `docs/guidelines/writing/` の各ファイル。

## 言語

- ドキュメント (AGENTS.md、`docs/`、skills、prompts、troubleshots) は日本語で書く。
- コード中のコメントは、各ファイルの既存の言語に合わせる。

## 原則

- 1 ドキュメントに論旨は 1 つ。網羅性より、論旨を絞ることを優先する。
- 論旨と関係の薄い補足情報を書かない。
- 同じ主張を言葉を変えて繰り返さない。
- 冗長な表現を避け、端的に書く。前置き・まとめ・「〜が重要です」のような中身のない文 (Slop) を書かない。
- コード・設定・Lint から読み取れる事実は書き写さず、パスを示す。
- 他の Markdown はリンクにせず、リポジトリルートからのパスで参照する。

## ユビキタス言語

- 用語の正は `docs/CONTEXT.md` の Ubiquitous Language。書き方は `docs/guidelines/writing/context.md`。
- 同じ概念を別の言葉で呼ばない。ドキュメント、コード、コミットメッセージで `docs/CONTEXT.md` の用語を使う。
- 議論で用語が変わったり新しい用語が生まれたりしたら、その場で `docs/CONTEXT.md` を更新する。

## レビュー

書き終えたら、`docs/guidelines/review/index.md` の `Docs Review` を SubAgent に実行させ、指摘を反映する。
