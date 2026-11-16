# Configure Harness

リポジトリにコーディングエージェント向けのハーネス (AGENTS.md、REVIEW.md、`docs/guidelines/`、`.agents/troubleshots/`) を持ち込む playbook。`/configure-harness` prompt はこれへの alias。

- 旧 `kimuson-harness` skill の `playbooks/configure-harness.md` と `~/.agents/deps/configure-harness/` の移植。`~/repos/agentic-cf` で育てたハーネスの構造をテンプレートにしている
- テンプレートと観察・提案の条件は `references/shared/recommended-patterns/agent-harness/` (`template/` と `index.md`) に置く
- 旧版の setup のうち core だけを移した。プロジェクトの進行をエージェントがリードする `auto-pilot` と、決定論的な検査 (Lean による仕様の証明と差分テスト、CodeQL、gitleaks など) を持ち込む `deterministic` は移植の対象外にした

## 保守

- テンプレートは生成先と同じ構造にする。選んだときだけ生成するファイルは `<name>.optional.<ext>` (拡張子のないファイルは `<name>.optional`)、ディレクトリは `<name>.optional/` と名付け、どんなときに提案するかはパターンの `index.md` に書く
- decision の id は一意にする。プロジェクトごとに決める箇所は `<!-- decision: <id> -->` のブロックにし、`決めること`・`観察`・`書き方` の 3 項目を書く。質問文は書かない
- テンプレートを変えたら `node scripts/decisions.ts check` を実行する

本文: [PLAYBOOK.md](./PLAYBOOK.md)
