# configure-harness

リポジトリにコーディングエージェント向けのハーネス (AGENTS.md、REVIEW.md、`docs/guidelines/`、`.agents/troubleshots/`) を持ち込む prompt (`/configure-harness`)。本体は `chezmoi/dot_agents/prompts/configure-harness.md` で、テンプレート・手順書・スクリプトはこのディレクトリ (配布先は `~/.agents/deps/configure-harness/`) に置く。`~/repos/agentic-cf` で育てたハーネスの構造をテンプレートにし、プロジェクトごとに決める箇所はエージェントが観察から提案し、ユーザーの意図が要るものと判断が分かれるものだけを Plan のページでレビューする。

## 利用する場面

- 新しいリポジトリにハーネスを用意するとき (`/configure-harness`)
- 既存のリポジトリのハーネスを、この構造に揃えるとき。既存のファイルは差分を見せてから取り込む
- 実装タスクの完了の定義 (どこまで進めるか、どの検証を通すか) を決め直すとき

## 動作の概要

1. リポジトリを観察する (既存のハーネス、git log、PR の履歴、マニフェスト、CI、使っている AI レビューツール)。
2. Plan のページで、生成後のハーネスのツリー、既存のファイルからの変更、ユーザーの意図が要る提案と判断が分かれる提案だけを見せる。リポジトリから素直に決まる提案は見せずに反映する。完了の定義は常に最初の質問にし、ほかの質問は、リポジトリから読み取れないことと観察が食い違うことだけにする。
3. テンプレートから生成・マージし、決定ポイントが残っていないことを検査して、後で決めることにした TODO を報告する。

ページは `dev-process-kit` skill で作り、Claude Code では Artifact で出す。

## 生成するもの

| 区分 | 生成するもの |
| --- | --- |
| 常に | `AGENTS.md`、`REVIEW.md`、`docs/guidelines/` のガイドライン (harness、delegate、commit、writing、coding、quality-assurance、local-dev)、`.agents/troubleshots/` |
| 提案して選ぶ | 用語の文書 (`docs/CONTEXT.md` か、`docs/CONTEXT-MAP.md` と `docs/contexts/<context>/` のどちらか)、ADR と Design Doc の書き方 |

レビューの観点は `REVIEW.md` を正本にする。Claude Code と Copilot は REVIEW.md を直接読み、Codex などは AGENTS.md の `Code Review Rules` 節から REVIEW.md を読む。QA Check はレビューから分け、`docs/guidelines/quality-assurance/` に、不具合と手法の対応表、そこから導く探索的テストの観点、報告の内容 (approve / reject / human-check。書式は出し先に合わせる)、起動と操作の手順 (`exploratory-testing.md`)、人が確かめる基準 (`human-check-criteria.md`) を置く。

完了の定義は、到達点 (EditOnly / Main Push / Draft PR / Open PR / Merge PR) と、通す検証 (CI Pass、Review、QA Check) で `docs/guidelines/delegate.md` に書く。branch、pull-request、deploy のガイドラインと、Lint・hook などの機械的な強制は対象外。

## 保守

- `exact_templates/` は生成先と同じ構造にする。選んだときだけ生成するファイルは `<name>.optional.<ext>`、ディレクトリは `<name>.optional/` と名付ける。どんなときに提案するかは `exact_references/plan.md` の表に書く。
- ドットで始まるパスは chezmoi の `dot_` で書く (`dot_agents/`)。配布先では生成先と同じ名前になる。空のファイルは `empty_` を付ける。
- `exact_templates/` と `exact_references/` は `exact_` にして、ソースから消したファイルを配布先からも消す。
- プロジェクトごとに決める箇所は `<!-- decision: <id> -->` のブロックにし、`決めること`・`観察`・`書き方` の 3 項目を書く。質問文は書かない。
- テンプレートを変えたら `node scripts/decisions.ts check` を実行する。スクリプトを変えたら `node --test 'scripts/*.test.ts'` と、chezmoi リポジトリのルートで `internal/node_modules/.bin/tsc -p chezmoi/dot_agents/deps/configure-harness/scripts` を実行する。
- agentic-cf のガイドラインを改善したら、プロジェクトに依存しない部分をテンプレートへ反映する。
