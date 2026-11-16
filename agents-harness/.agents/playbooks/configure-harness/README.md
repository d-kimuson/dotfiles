# Configure Harness

リポジトリにコーディングエージェント向けのハーネス (AGENTS.md、REVIEW.md、`docs/guidelines/`、`.agents/troubleshots/`) と、その上に載せる auto-pilot を持ち込む playbook。`/configure-harness` prompt はこれへの alias (引数は `core` か `auto-pilot`)。

- 旧 `kimuson-harness` skill の `playbooks/configure-harness.md` と `~/.agents/deps/configure-harness/` の移植。`~/repos/agentic-cf` で育てたハーネスの構造をテンプレートにしている
- テンプレートと setup ごとの手順書は、`references/shared/recommended-patterns/` の `agent-harness/` (core) と `agent-auto-pilot/` (auto-pilot) に置く。setup ごとの手順書は各パターンの `index.md`
- 決定論的な検査 (Lean による仕様の証明と差分テスト、CodeQL、gitleaks など) を持ち込む `deterministic` setup は移植の対象外にした

## 保守

- テンプレートは生成先と同じ構造にする。選んだときだけ生成するファイルは `<name>.optional.<ext>` (拡張子のないファイルは `<name>.optional`)、ディレクトリは `<name>.optional/` と名付け、どんなときに提案するかはパターンの `index.md` に書く
- setup を足すときは、パターンを作り、`scripts/decisions.ts` の `SETUPS` と PLAYBOOK.md の対応表に足す
- decision の id は setup をまたいで一意にする。プロジェクトごとに決める箇所は `<!-- decision: <id> -->` のブロックにし、`決めること`・`観察`・`書き方` の 3 項目を書く。質問文は書かない
- テンプレートを変えたら `node scripts/decisions.ts check` を実行する

本文: [PLAYBOOK.md](./PLAYBOOK.md)
