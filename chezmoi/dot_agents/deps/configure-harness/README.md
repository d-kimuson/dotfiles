# configure-harness

リポジトリにコーディングエージェント向けのハーネス (AGENTS.md、REVIEW.md、`docs/guidelines/`、`.agents/troubleshots/`) と、その上に載せる仕組み (auto-pilot、決定論的な検査) を持ち込む prompt (`/configure-harness [core|auto-pilot|deterministic]`)。本体は `chezmoi/dot_agents/prompts/configure-harness.md` で、setup ごとの手順書・テンプレート・共通の手順書・スクリプトはこのディレクトリ (配布先は `~/.agents/deps/configure-harness/`) に置く。`~/repos/agentic-cf` で育てたハーネスの構造をテンプレートにし、プロジェクトごとに決める箇所はエージェントが観察から提案し、ユーザーの意図が要るものと判断が分かれるものだけを Plan のページでレビューする。

## 利用する場面

- 新しいリポジトリにハーネスを用意するとき (`/configure-harness`)
- プロジェクトの進行をエージェントに任せたいとき (`/configure-harness auto-pilot`)
- レビューや QA に頼っている検査を、ツールや証明に置き換えたいとき (`/configure-harness deterministic`)
- 既存のリポジトリのハーネスを、この構造に揃えるとき。既存のファイルは差分を見せてから取り込む
- 実装タスクの完了の定義 (どこまで進めるか、どの検証を通すか) を決め直すとき

## 動作の概要

1. 引数の setup (省略時は core) の手順書 `exact_setups/<setup>.md` を読む。前提 (core のハーネスがあるかなど)、観察すること、選択式のファイルを提案する条件、Plan のページに必ず出すものは手順書が決める。
2. リポジトリを観察する (既存のハーネス、git log、PR の履歴、マニフェスト、CI、使っている AI レビューツール)。
3. Plan のページで、生成後のハーネスのツリー、既存のファイルからの変更、ユーザーの意図が要る提案と判断が分かれる提案だけを見せる。リポジトリから素直に決まる提案は見せずに反映する。core では完了の定義を常に最初の質問にし、ほかの質問は、リポジトリから読み取れないことと観察が食い違うことだけにする。
4. テンプレートから生成・マージし、決定ポイントが残っていないことを検査して、後で決めることにした TODO を報告する。

ページは `dev-process-kit` skill で作り、Claude Code では Artifact で出す。

## 生成するもの

| setup | 常に | 提案して選ぶ |
| --- | --- | --- |
| core | `AGENTS.md`、`REVIEW.md`、`docs/guidelines/` のガイドライン (harness、delegate、commit、writing、coding、quality-assurance、local-dev)、`.agents/troubleshots/` | 用語の文書 (`docs/CONTEXT.md` か、`docs/CONTEXT-MAP.md` と `docs/contexts/<context>/` のどちらか)、ADR と Design Doc の書き方、Backlog (`backlog.md`)、ユーザーへの質問と報告の送り先 (`team-channel.md`) |
| auto-pilot | `docs/guidelines/auto-pilot.md`、`.agents/auto-pilot/` (定期タスクの判定スクリプトと manifest)。core の Backlog・team-channel・ADR・Design Doc がなければ一緒に生成する | 定期タスク (セキュリティレビュー、攻撃による探索、Chaos UI Engineering、一括依存アップデート、デッドコードの削除、ライセンスの確認、CI の高速化、Analytics と Production Observability からの改善トリアージ) |
| deterministic | なし | CodeQL、gitleaks、Lean による仕様の証明と差分テスト (Lean キット)、Quint、PBT、Lint ルール。テンプレートを持つのは Lean キットだけ |

レビューの観点は `REVIEW.md` を正本にする。Claude Code と Copilot は REVIEW.md を直接読み、Codex などは AGENTS.md の `Code Review Rules` 節から REVIEW.md を読む。QA Check はレビューから分け、`docs/guidelines/quality-assurance/` に、不具合と手法の対応表、そこから導く探索的テストの観点、報告の内容 (approve / reject / human-check。書式は出し先に合わせる)、起動と操作の手順 (`exploratory-testing.md`)、人が確かめる基準 (`human-check-criteria.md`) を置く。

auto-pilot は、`/goal docs/guidelines/auto-pilot.md に従い、このプロジェクトが凍結されるまでこのプロジェクトの進行をリードすること` のように起動する、プロジェクトマネジメントだけを行うエージェントのガイドライン。ターン (prepare → action → feedback → clean-up) ごとに行動を 1 つ選び、実装と設計は Independent Agent (既定は worktree を使う SubAgent。起動手段を指定すれば差し替えられる)、調査は SubAgent に任せる。ターンの終わりに `.agents/auto-pilot/context.md` を更新し、self-compact の `compact` ツール (Claude Code のローカルプラグインと Pi の extension) で compact して次のターンを始める。`context.md`・`tasks/`・定期タスクの最終実行は Git で管理しない。定期タスクの判定は `.agents/auto-pilot/scripts/maintenance.ts` (Node.js 24.2 以降) で行う。

Lean キットは、仕様を Lean で書いて証明し、人は Lean ではなく doc コメントから生成した Markdown (`<name>.lean.md`。定義・制約・定理の一覧) で仕様を読む仕組み。Lean、実装、生成した Markdown、差分テストは同じディレクトリに並べる。`scripts/lean-spec.ts` (Node.js 24.2 以降) が Markdown の生成と、doc のない宣言・`sorry`・`axiom`・古い Markdown の検査を行い、`spec/Oracle.lean` の実行ファイル `spec-oracle` が JSON で仕様の定義を評価して、実装との差分テスト (PBT) に使われる。

完了の定義は、到達点 (EditOnly / Main Push / Draft PR / Open PR / Merge PR) と、通す検証 (CI Pass、Review、QA Check) で `docs/guidelines/delegate.md` に書く。branch、pull-request、deploy のガイドラインと、Lint・hook などの機械的な強制は対象外。

## 保守

- `exact_templates/<setup>/` は生成先と同じ構造にする。選んだときだけ生成するファイルは `<name>.optional.<ext>` (拡張子のないファイルは `<name>.optional`)、ディレクトリは `<name>.optional/` と名付ける。どんなときに提案するかは `exact_setups/<setup>.md` に書く。setup を足すときは、`exact_setups/<setup>.md` と `exact_templates/<setup>/` を対で作り、prompt の setup の一覧に足す。
- decision の id は setup をまたいで一意にする。
- ドットで始まるパスは chezmoi の `dot_` で書く (`dot_agents/`)。配布先では生成先と同じ名前になる。空のファイルは `empty_` を付ける。
- `exact_templates/`・`exact_setups/`・`exact_references/` は `exact_` にして、ソースから消したファイルを配布先からも消す。
- プロジェクトごとに決める箇所は `<!-- decision: <id> -->` のブロックにし、`決めること`・`観察`・`書き方` の 3 項目を書く。質問文は書かない。
- テンプレートを変えたら `node scripts/decisions.ts check` を実行する。スクリプト (テンプレートの `maintenance.ts` と `lean-spec.optional.ts` を含む) を変えたら `node --test 'scripts/*.test.ts'` と、chezmoi リポジトリのルートで `internal/node_modules/.bin/tsc -p chezmoi/dot_agents/deps/configure-harness/scripts` を実行する。
- agentic-cf のガイドラインを改善したら、プロジェクトに依存しない部分をテンプレートへ反映する。
