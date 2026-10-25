---
name: kimuson-harness
description: Set up and sync a coding-agent harness that keeps .agents/skills, .agents/prompts, and AGENTS.md as the single source across Claude Code, Command Code, Pi, OpenCode, and Cursor. Use when adding agent config to a repo, checking whether each CLI sees the shared skills and prompts, creating missing symlinks, or scaffolding a new project harness.
---

# Kimuson Harness

`.agents/` を正本にし、各 CLI が読めない場所だけを symlink する。
対象は Claude Code、Command Code、Pi、OpenCode、Cursor Agent CLI。
Codex / Gemini CLI、subagent 定義、MCP は対象外。

## 標準レイアウト

```text
AGENTS.md
.agents/
├── skills/
└── prompts/
```

- skills: `SKILL.md` を持つディレクトリ。`references/`、`scripts/`、`assets/` を同梱できる。
- prompts: `/<name>` で起動する Markdown。資料は `.agents/deps/<name>/` に置く。
- memory: プロジェクト直下の `AGENTS.md`。`.agents/AGENTS.md` は project memory としては読まれない。

## クイックスタート

`/harness-sync` は user-scope の prompt で、次の script を実行する。

```bash
bash ~/.agents/skills/kimuson-harness/scripts/sync-harness.sh --check
bash ~/.agents/skills/kimuson-harness/scripts/sync-harness.sh
bash ~/.agents/skills/kimuson-harness/scripts/sync-harness.sh --global
bash ~/.agents/skills/kimuson-harness/scripts/sync-harness.sh --all --dry-run
```

- default: project scope の link を check して、足りないものを貼る。
- `--check`: 変更せず、不足・衝突を報告する。問題があれば exit 1。
- `--global`: user scope の link。
- `--all`: project と global の両方。
- `--tool claude|command-code|pi|opencode|cursor`: 対象を絞る。
- 実ディレクトリや別 target の symlink は消さない。衝突として報告する。

## 原則

- 正本は 1 つ。`.agents` に置き、CLI 側へコピーしない。
- ネイティブに読めるなら symlink を貼らない。読めない場所だけ貼る。
- symlink は相対 target にする (`../.agents/...`)。
- project memory は root `AGENTS.md`。`CLAUDE.md` があるプロジェクトでは Claude Code がそちらを優先する。
- 既存の実ディレクトリは自動で消さない。中身を `.agents` に移してから symlink に置き換える。

## マトリクス（project scope）

| Tool | skills | prompts/commands | memory |
| --- | --- | --- | --- |
| Claude Code | `.claude/skills` → `../.agents/skills` | `.claude/commands` → `../.agents/prompts` | root `AGENTS.md`（`CLAUDE.md` があればそちら） |
| Command Code | `.agents/skills` native | `.commandcode/commands` → `../.agents/prompts` | root `AGENTS.md` |
| Pi | `.agents/skills` native | `.pi/prompts` → `../.agents/prompts` | root `AGENTS.md` / `CLAUDE.md` |
| OpenCode | `.agents/skills` native | `.opencode/commands` → `../.agents/prompts` | root `AGENTS.md` |
| Cursor Agent | `.agents/skills` native | `.cursor/commands` → `../.agents/prompts` | root `AGENTS.md` / `CLAUDE.md` |

正確なパス、user scope、公式 docs は `references/harness-matrix.md` を読む。

## 新規プロジェクトの scaffold

`references/configure-harness.md` の手順と `~/.agents/deps/configure-harness/` の templates / setups / scripts を使う。
`/configure-harness` prompt はこの reference への薄い入口。

## References

| いつ読むか | 参照先 |
| --- | --- |
| tool ごとの探索パス、user scope、公式 docs | `references/harness-matrix.md` |
| symlink の貼り方、衝突時の移行、check の意味 | `references/sync.md` |
| 新規プロジェクトの harness 設計（旧 configure-harness） | `references/configure-harness.md` |
