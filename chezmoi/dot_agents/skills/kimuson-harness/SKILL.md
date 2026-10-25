---
name: kimuson-harness
description: Use when the user asks to sync .agents skills/prompts or configure a project harness for Claude Code, Command Code, Pi, OpenCode, or Cursor.
---

# Kimuson Harness

project-scope の `.agents` harness を管理する。
対象 CLI: Claude Code、Command Code、Pi、OpenCode、Cursor Agent CLI。

## Playbooks

指示やキーワードが次の playbook に当たるなら、その playbook を読んで従う。playbook 内のパスは skill root 基準。

| keyword / request | playbook |
| --- | --- |
| sync / 同期 / symlink / check / 揃える | `playbooks/sync.md` |
| configure / setup / scaffold / harness 作成 | `playbooks/configure-harness.md` |

どれにも当たらなければ `references/` を見て判断する。

## References

- `references/design.md`: スキルとプロンプトの設計
- `references/harness-matrix.md`: tool ごとの探索パス
