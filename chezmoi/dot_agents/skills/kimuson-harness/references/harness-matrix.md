# Harness matrix

project scope の探索パス。`R` = ネイティブに読む。`L` = `.agents` への symlink が必要。

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
- Pi の project prompt は `.pi/prompts`。Pi 1.4.0 は `piConfig.configDir = ".pi"`、`projectPromptsDir = resolve(cwd, ".pi", "prompts")` で解決する。`.pi/agent/prompts` は読まれない（global は `~/.pi/agent/prompts`）。
- OpenCode の command は `.opencode/commands`。旧 `command/` も読むが、新規は `commands/`。
- Cursor の custom command は `.cursor/commands`。`/migrate-to-skills` で skill に変換できる。
- どの tool も project memory は root `AGENTS.md`（または `CLAUDE.md`）。`.agents/AGENTS.md` は project memory ではない。

## Sources

- Claude Code: <https://code.claude.com/docs/en/memory>、<https://code.claude.com/docs/en/skills>、<https://code.claude.com/docs/en/slash-commands>
- Command Code: <https://commandcode.ai/docs>（skills / slash commands / memory）
- Pi: `@earendil-works/pi-coding-agent` 1.4.0 の `package.json`、`dist/core/prompt-templates.js`、`dist/core/skills.js`、`docs/prompt-templates.md`、`docs/skills.md`
- OpenCode: <https://opencode.ai/v2/docs/skills>、<https://opencode.ai/v2/docs/commands>、<https://opencode.ai/docs/rules/>
- Cursor: <https://cursor.com/docs/skills>、<https://cursor.com/docs/cli/using>、<https://cursor.com/docs/reference/deeplinks>
