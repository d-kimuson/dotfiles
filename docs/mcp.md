# MCP 設定の配布

MCP サーバ設定のマスターは `config/mcp.template.json` である。
`internal-cli mcp deliver` はこの定義を各クライアントの形式へ変換して、既存設定へマージする。

## 入力

| ファイル | 役割 |
| --- | --- |
| `config/mcp.template.json` | 共通 MCP サーバ定義。`${VAR}` の環境変数展開を使える |
| `config/mcp.template.local.json` | Git 管理外のローカル上書き。存在すると後勝ちでマージする |
| `chezmoi/dot_copilot/mcp-config.json.tmpl` | GitHub Copilot 用の chezmoi テンプレート |
| `config/modular-mcp.json` | Copilot 用テンプレートが参照する設定 |

`${VAR}` が未定義のサーバは警告して配布対象から外す。
`DISABLE_MCPS` にカンマ区切りで指定したサーバも配布しない。

## 配布先

| target | 配布先 | 形式 |
| --- | --- | --- |
| `claude-code` | `~/.claude.json` | JSON の `mcpServers` |
| `claude-desktop` | `~/Library/Application Support/Claude/claude_desktop_config.json` | JSON の `mcpServers` |
| `codex` | `~/.codex/config.toml` | TOML の `mcp_servers` |
| `pi-agent` | `~/.pi/agent/mcp.json` | JSON の `mcpServers` |
| GitHub Copilot | `~/.copilot/mcp-config.json` | chezmoi によるテンプレート配布 |

`mcp deliver` は Pi 用の親ディレクトリだけを作成する。
他のクライアントの設定ディレクトリは、対象アプリケーションを一度起動するなどして先に用意する。

## 更新手順

1. `config/mcp.template.json` を更新する。
2. 必要な環境変数を読み込む。
3. `node internal/src/cli.ts mcp deliver --dry-run` で出力を確認する。
4. `node internal/src/cli.ts mcp deliver` で配布する。
5. Copilot のテンプレートを更新した場合は `chezmoi apply` も実行する。
6. `npx vitest run internal/src/mcp/deliver.test.ts` を実行する。

`dotfiles-apply` は MCP 設定を配布しない。
MCP 定義を変更したときは `mcp deliver` を明示的に実行する。
