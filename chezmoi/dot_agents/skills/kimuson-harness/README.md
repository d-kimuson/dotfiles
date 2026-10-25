# kimuson-harness

プロジェクトの `.agents` harness を管理する skill。
対象 CLI: Claude Code、Command Code、Pi、OpenCode、Cursor Agent CLI。

## Skill を書くときのガイドライン

- スキルには `README.md` を必ず置く。
- `SKILL.md` には運用上の事情や管理上の設計意図を書かない。`README.md` に分ける。
- `SKILL.md` は、読む人がそのタスクに必要とする情報だけに絞る。
- `README.md` という置き場所を用意することで、`SKILL.md` を太らせずに済む。

`/harness-sync` で `.agents/skills` と `.agents/prompts` への symlink を check / 作成する。
設計は `references/design.md`、探索パスは `references/harness-matrix.md`、同期は `references/sync.md` を参照する。
