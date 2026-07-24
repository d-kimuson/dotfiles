# harness-engineering

Coding Agent の harness を、特定製品に依存しない `AGENTS.md` と Agent Skills で設計するための skill です。
リポジトリ向け指示や skill の新規作成、構成整理、レビューに利用します。

## 利用する場面

- `AGENTS.md` を新規作成または整理するとき
- Claude Code との互換性を symlink で用意するとき
- Agent Skill を新規作成または整理するとき
- runtime context とメンテナンス文書の責務を分離するとき
- permission や hooks など、製品固有の設定を隔離するとき

## 動作の概要

この skill は、対象に応じて `references/agents-md.md` または `references/skills.md` を読み込みます。
Claude Code 固有の permission や hooks を扱う場合だけ、`references/tools/claude-code/` 以下を追加で参照します。

生成物では、常時読み込まれる情報を最小化し、詳細なガイドラインを必要な作業時だけ読む構造に分けます。
複雑な反復処理は `scripts/`、明示的に呼び出す連続手順は `workflows/` へ分離します。

## ワークフロー

現在、同梱している workflow はありません。
手続き的な利用方法を追加した場合は、`workflows/` に手順書を置き、この節へ名前と動作概要を追記します。

## メンテナンス

`SKILL.md` には、skill が読み込まれた後の実行に必要な情報だけを記載します。
いつ利用するか、利用者が何を期待できるか、workflow の一覧など、人間向けの情報はこの `README.md` に記載します。

Agent Skills の標準 frontmatter は `name` と `description` を使用し、製品固有の拡張は必要になるまで追加しません。
`SKILL.md` の本文は英語で記載し、言語固有の表現や固有名詞は元の言語を保ちます。
