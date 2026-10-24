# MCP の設計

## 正本

`config/agent/mcp.template.json` が唯一の master。
各 target の MCP 設定は生成物で、直接編集しない。

## 層

- `core`: すべての環境で使う。例: obsidian。
- `personal`: 個人環境だけで使う。例: Personal MCP Portal (`kimuson`)。
- `MCP_LAYERS` (カンマ区切り) で選ぶ。既定は `core`。
- 個人マシンは `shell/localrc.sh` に `export MCP_LAYERS=core,personal` を置く。
- master の全定義は `config/agent/mcp.template.json` に置く。

## remote と connector

- `remote: true` は「Claude Code / Claude Desktop / Codex 側の cloud connector で代替できる」の意味。
  transport が stdio でも、業務 API のように connector 対象なら true にする。
- connector target: `claude-code`、`claude-desktop`、`codex`。
  remote は配らず、local だけを merge する。
- direct target: `pi-agent`、`command-code`、`opencode`。
  local も remote も配る。
- Claude/Codex はアプリ内部の local MCP を消さないため merge。
  Pi/Command Code/OpenCode は生成物として replace。

## OpenCode

`~/.config/opencode/opencode.json` の `mcp.servers` に書く。

- local: `{ "type": "local", "command": ["cmd", ...args], "environment": {...} }`
- remote: `{ "type": "remote", "url": "...", "headers": {...} }`

## 秘密情報

- master には `${VAR}` だけを書く。
- 未定義の env がある server はその実行だけ skip する。
- `DISABLE_MCPS` で一時的に除外できる。
- dry-run は値ではなくキーパスだけを出す。

## 運用

詳細は `docs/mcp.md`。
変更時は `mcp deliver --dry-run` → `mcp deliver` → `npx vitest run internal/src/mcp/deliver.test.ts`。
