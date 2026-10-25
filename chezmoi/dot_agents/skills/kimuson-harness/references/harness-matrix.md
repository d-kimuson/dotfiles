# Harness matrix

`R` = ネイティブに読む。`L` = `.agents` への symlink が必要。`-` = 対象外。

## Project scope

| Tool | skills | prompts / commands | memory |
| --- | --- | --- | --- |
| Claude Code | `.claude/skills` (L) | `.claude/commands` (L) | root `AGENTS.md`（`CLAUDE.md` があれば `CLAUDE.md`） |
| Command Code | `.agents/skills` (R) | `.commandcode/commands` (L) | root `AGENTS.md` / `.commandcode/AGENTS.md` |
| Pi | `.agents/skills` (R) | `.pi/prompts` (L) | root `AGENTS.md` / `CLAUDE.md` |
| OpenCode | `.agents/skills` (R) | `.opencode/commands` (L) | root `AGENTS.md`（`CLAUDE.md` fallback） |
| Cursor Agent | `.agents/skills` (R) | `.cursor/commands` (L) | root `AGENTS.md` / `CLAUDE.md` |

補足:

- Claude Code は `.agents/skills` を読まない。`.claude/skills` を symlink する。
- Command Code は `.agents/skills` を自動発見する。`.commandcode/skills` は上書き用で、通常は作らない。
- Pi の project prompt は `.pi/prompts`。`.pi/agent/prompts` は Pi 0.74 では読まれない。
- OpenCode の command は `.opencode/commands`。旧 `command/` も読むが、新規は `commands/`。
- Cursor の custom command は `.cursor/commands`。`/migrate-to-skills` で skill に変換できる。
- どの tool も project memory は root `AGENTS.md`（または `CLAUDE.md`）。`.agents/AGENTS.md` は project memory ではない。

## User scope

| Tool | skills | prompts / commands | memory |
| --- | --- | --- | --- |
| Claude Code | `~/.claude/skills` (L) | `~/.claude/commands` (L) | `~/.claude/CLAUDE.md` (L to `~/.agents/AGENTS.md`) |
| Command Code | `~/.agents/skills` (R) | `~/.commandcode/commands` (L) | `~/.commandcode/AGENTS.md` (L) |
| Pi | `~/.agents/skills` (R) | `~/.pi/agent/prompts` (L) | `~/.pi/agent/AGENTS.md`（Pi 固有。必要なら別管理） |
| OpenCode | `~/.agents/skills` (R) | `~/.config/opencode/commands` (L) | `~/.config/opencode/AGENTS.md` (L) |
| Cursor Agent | `~/.agents/skills` (R) | `~/.cursor/commands` (L、best effort) | global rules は Cursor の settings。project `AGENTS.md` を使う |

補足:

- Claude Code の global skills/commands は `.agents` を読まないので symlink 必須。
- Command Code / Pi / OpenCode / Cursor は `~/.agents/skills` をネイティブに読む。skills の symlink は不要。
- OpenCode は `~/.agents/skills` を compatibility として読む。`~/.config/opencode/skills` の symlink は冗長だが害はない。
- Cursor の `~/.cursor/commands` は環境によっては拾われない報告がある。project `.cursor/commands` を優先する。
- Pi の global memory `~/.pi/agent/AGENTS.md` は Pi 固有ルールを持つため、`~/.agents/AGENTS.md` への symlink を強制しない。

## 対象外

- Codex / Gemini CLI: 現在の標準 harness では使わない。
- Subagents: built-in の有無・定義形式・探索パスが tool ごとに違いすぎる。必要になったプロジェクトで個別に扱う。
- MCP: dotfiles 側の `config/agent/mcp.template.json` と `mcp deliver` で管理する。

## Sources

- Claude Code: <https://code.claude.com/docs/en/memory>、<https://code.claude.com/docs/en/skills>、<https://code.claude.com/docs/en/slash-commands>
- Command Code: <https://commandcode.ai/docs>（skills / slash commands / memory）
- Pi: `@earendil-works/pi-coding-agent` の `docs/skills.md`、`docs/prompt-templates.md`、`docs/usage.md`
- OpenCode: <https://opencode.ai/v2/docs/skills>、<https://opencode.ai/v2/docs/commands>、<https://opencode.ai/docs/rules/>
- Cursor: <https://cursor.com/docs/skills>、<https://cursor.com/docs/cli/using>、<https://cursor.com/docs/reference/deeplinks>
