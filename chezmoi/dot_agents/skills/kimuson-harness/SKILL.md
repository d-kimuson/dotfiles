---
name: kimuson-harness
description: Use when setting up or checking a project's .agents skills and prompts for Claude Code, Command Code, Pi, OpenCode, or Cursor.
---

# Kimuson Harness

project-scope の `.agents` harness を管理する。
対象 CLI: Claude Code、Command Code、Pi、OpenCode、Cursor Agent CLI。

- 設計: `references/design.md`
- tool ごとの探索パス: `references/harness-matrix.md`
- symlink の同期: `references/sync.md`、`/harness-sync`
- 新規 scaffold: `references/configure-harness.md`

プロジェクトで `/harness-sync` を実行する。check だけなら `--check`。
