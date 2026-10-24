# MCP 設定の配布

MCP サーバ設定のマスターは `config/agent/mcp.template.json` である。
`internal-cli mcp deliver` が層を選び、各クライアントの形式へ変換して配布する。

## 層と環境差

`config/agent/mcp.template.json` の各サーバは `layer` を持つ。
`MCP_LAYERS` (カンマ区切り) に含まれる層だけを配布する。既定は `core`。

| layer | 用途 |
| --- | --- |
| `core` | すべての環境で使うサーバ (例: obsidian) |
| `personal` | 個人環境だけで使うサーバ (例: Personal MCP Portal) |

```bash
# 個人マシン (~/.local/share/chezmoi/shell/localrc.sh)
export MCP_LAYERS=core,personal
```

`shell/localrc.sh` と `shell/env-secrets.sh` は Git 管理外である。

## サーバ定義

```json
{
  "mcpServers": {
    "obsidian": {
      "layer": "core",
      "type": "stdio",
      "command": "${OBSIDIAN_VAULT_PATH}/.obsidian/plugins/mcp-tools/bin/mcp-server",
      "args": [],
      "env": { "OBSIDIAN_API_KEY": "${OBSIDIAN_API_KEY}" }
    },
    "kimuson": {
      "layer": "personal",
      "type": "http",
      "url": "https://mcp.kimuson.dev/mcp",
      "remote": true
    }
  }
}
```

- `layer`: `core` または `personal`。省略時は `core`。
- `remote: true`: Claude Code / Claude Desktop / Codex 側の cloud connector で代替できるサーバ。
  これらの target には配布せず、Pi / Command Code / OpenCode にだけ配布する。
- `excludeTargets: ["target"]`: 特定の target だけ明示的に除外する。
- `${VAR}` が未定義のサーバは警告して配布対象から外す。
- `DISABLE_MCPS` にカンマ区切りで指定したサーバも配布しない。
- `chezmoi/dot_copilot/mcp-config.json.tmpl` と `config/agent/modular-mcp.json` は GitHub Copilot 用。

## 配布先

| target | 配布先 | 形式 | remote の扱い |
| --- | --- | --- | --- |
| `claude-code` | `~/.claude.json` | JSON の `mcpServers` | connector で代替するため配らない |
| `claude-desktop` | `~/Library/Application Support/Claude/claude_desktop_config.json` | JSON の `mcpServers` | connector で代替するため配らない |
| `codex` | `~/.codex/config.toml` | TOML の `mcp_servers` | connector で代替するため配らない |
| `pi-agent` | `~/.pi/agent/mcp.json` | JSON の `mcpServers` | 配る |
| `command-code` | `~/.commandcode/mcp.json` | JSON の `mcpServers` (`transport` 形式) | 配る |
| `opencode` | `~/.config/opencode/opencode.json` | JSON の `mcp.servers` (`local` / `remote`) | 配る |
| GitHub Copilot | `~/.copilot/mcp-config.json` | chezmoi によるテンプレート配布 | 対象外 |

Claude Code / Claude Desktop / Codex は既存の `mcpServers` / `mcp_servers` にマージする。
アプリや別ツールが登録した local MCP (Codex の `node_repl` など) を消さないためである。
それ以外の target は生成物として全置換し、前回の配布や他エージェントから import したサーバを残さない。

OpenCode では local サーバを `{ "type": "local", "command": ["cmd", ...args], "environment": {...} }`、
remote サーバを `{ "type": "remote", "url": "...", "headers": {...} }` に変換する。

`mcp deliver` は Pi / Command Code / OpenCode 用の親ディレクトリを作成する。
他のクライアントの設定ディレクトリは、対象アプリケーションを一度起動するなどして先に用意する。

## 更新手順

1. `config/agent/mcp.template.json` を更新する。
2. マシン固有の層と追加分を `shell/localrc.sh` などに設定する。
3. 必要な環境変数を読み込む。
4. `node internal/src/cli.ts mcp deliver --dry-run` で出力を確認する。
5. `node internal/src/cli.ts mcp deliver` で配布する。
6. Copilot のテンプレートを更新した場合は `chezmoi apply` も実行する。
7. `npx vitest run internal/src/mcp/deliver.test.ts` を実行する。

`dotfiles-apply` は MCP 設定を配布しない。
MCP 定義を変更したときは `mcp deliver` を明示的に実行する。
