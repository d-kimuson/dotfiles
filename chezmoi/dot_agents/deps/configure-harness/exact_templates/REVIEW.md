# Review

依頼された変更を、当てはまる観点ですべて見る。対象と出力の形式は依頼に従う。

## 観点

### Code Review

コードを変更したとき。誤った振る舞い、境界の漏れ、エラー処理の抜け、実行順序や並行性の問題、セキュリティの問題、責務の混在を探す。

### Guideline Review

常に。AGENTS.md の References から「いつ読むか」が変更に当てはまるガイドラインを全文読み、違反を探す。

### Docs Review

ドキュメント (`docs/`、`AGENTS.md`、`REVIEW.md`、skills、prompts、troubleshots) を変更したとき。`docs/guidelines/writing/index.md` と、変更した文書のタイプ別のガイドを読む。変更した文書は差分だけでなく全文を読み、違反を探す。

<!-- decision: review-patterns
  決めること: 足す観点
  観察: 形式仕様、DB スキーマ、公開 API など、専用の観点で見るべき資産。既存のレビュー設定 (REVIEW.md、.github/copilot-instructions.md、.coderabbit.yaml など) にある観点
  書き方: 観点ごとに `### <名前>` の節を足し、行う条件と探すものだけを書く。lint で強制できるものと、動かして確かめるもの (quality-assurance のガイドへ移す) は書かない
-->

## 指摘

- 指摘する前に周辺のコードやドキュメントを読み、本当に問題かを確かめる。
- Lint・型検査・テストが検出するものは指摘しない。
- 指摘ごとに、箇所と、起こる問題か破っているルールを書く。
