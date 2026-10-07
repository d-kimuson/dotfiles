# configure-harness

リポジトリにコーディングエージェント向けのハーネス (AGENTS.md、`docs/guidelines/`、レビューの観点、`.agents/` の skills と troubleshots) を持ち込む skill。`~/repos/agentic-cf` で育てたハーネスの構造をテンプレートにし、プロジェクトごとに決める箇所だけをユーザーと Grill で決める。

## 利用する場面

- 新しいリポジトリにハーネスを用意するとき (`/configure-harness`)
- 既存のリポジトリのハーネスを、この構造に揃えるとき。既存のファイルは差分を見せてから取り込む
- エージェントに任せる範囲 (コミット、push、PR、本番の操作など) を決め直すとき

## 動作の概要

1. リポジトリを観察する (既存のハーネス、git log、マニフェスト、CI、使っている AI レビューツール)。
2. Grill のページで、文書の言語、選択する機能、各決定ポイントを決める。観察結果は推奨として示し、確認はすべて取る。
3. Delegation Poker のページで、指示がないときにエージェントがやること・やらないことを決め、`delegate.md` に展開する。
4. テンプレートから生成・マージし、決定ポイントが残っていないことを検査して、後で決めることにした TODO を報告する。

ページは `dev-process-kit` skill で作り、Claude Code では Artifact で出す。

## 生成するもの

| 区分 | 生成するもの |
| --- | --- |
| コア | `AGENTS.md`、`docs/guidelines/{harness,delegate,commit}.md`、`docs/guidelines/writing/{index,troubleshoot}.md`、`docs/guidelines/review/index.md`、`.agents/troubleshots/` |
| スタック | `docs/guidelines/coding/index.md`、`docs/guidelines/quality-assurance/index.md`、`docs/guidelines/local-dev.md`。観察して書き、読み取れない部分はユーザーに聞いて書く |
| 選択 | AI レビューツール向けの参照ファイル (`REVIEW.md`、`.github/copilot-instructions.md`、AGENTS.md の Codex 向けの節)、`.agents/skills/review/`、ADR と Design Doc の書き方、Bounded Context の区分け (`docs/CONTEXT-MAP.md`、`docs/contexts/<context>/`) |

branch、pull-request、deploy のガイドラインと、Lint・hook などの機械的な強制は対象外。

## 保守

- テンプレートは `templates/<core|stack|optional/<feature>>/` に、生成先と同じパスで置く。chezmoi はドットで始まるエントリを配布しないので、`.agents/`・`.github/`・`.claude/` は `agents/`・`github/`・`claude/` と書く (`scripts/decision-block.ts` の `toTargetPath` が戻す)。
- プロジェクトごとに決める箇所は `<!-- decision: <id> -->` のブロックにし、`決めること`・`観察`・`書き方` の 3 項目を書く。質問文は書かない。
- テンプレートを変えたら `node scripts/decisions.ts check` を実行する。スクリプトを変えたら `node --test 'scripts/*.test.ts'` と、chezmoi リポジトリのルートで `internal/node_modules/.bin/tsc -p chezmoi/dot_agents/skills/configure-harness/scripts` を実行する。
- agentic-cf のガイドラインを改善したら、プロジェクトに依存しない部分をテンプレートへ反映する。
