# kimuson-harness

プロジェクトの `.agents` harness を管理する skill。
対象 CLI: Claude Code、Command Code、Pi、OpenCode、Cursor Agent CLI。

`/harness-sync` で `.agents/skills` と `.agents/prompts` への symlink を check / 作成する。
設計は `references/design.md`、探索パスは `references/harness-matrix.md`、同期は `references/sync.md` を参照する。
