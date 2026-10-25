# kimuson-harness

プロジェクトの `.agents` harness を管理する skill。
対象 CLI: Claude Code、Command Code、Pi、OpenCode、Cursor Agent CLI。

## スキルとプロンプトを書くときのガイドライン

- スキルには `README.md` を、プロンプトテンプレートには `.agents/deps/<name>/README.md` を必ず置く。
- `SKILL.md` / prompt 本体には運用上の事情や管理上の設計意図を書かない。README に分ける。
- `SKILL.md` / prompt 本体は、読む人がそのタスクに必要とする情報だけに絞る。
- README という置き場所を用意することで、本体を太らせずに済む。

`/harness-sync` で `.agents/skills` と `.agents/prompts` への symlink を check / 作成する。
設計は `references/design.md`、探索パスは `references/harness-matrix.md`、同期は `references/sync.md` を参照する。
