# 構成

このリポジトリは個人用 dotfiles を管理する。
設定は、マシン間で同じ内容にするものと、chezmoi テンプレートで環境差分を解決するものに分ける。
標準的な開発ツールは home-manager で宣言し、npm で配布される CLI とランタイムは mise で管理する。
この二つだけでは扱いづらい MCP と Coding Agent の設定は、`internal-cli` による配布機構で管理する。

## 管理層

| 層 | 役割 | 主なソース | 反映方法 |
| --- | --- | --- | --- |
| chezmoi | dotfiles とテンプレート | `chezmoi/` | `chezmoi apply` |
| home-manager | Nix で導入する標準ツール | `chezmoi/private_dot_config/home-manager/` | `home-manager switch` |
| mise | Node.js と npm 配布の CLI | `chezmoi/private_dot_config/mise/config.toml` | home-manager activation または `mise install` |
| internal CLI | MCP と Coding Agent のマージ・生成配布 | `config/`、`internal/src/` | `node internal/src/cli.ts …` |
| nix profile | daemon を使えないリモート環境のブートストラップ | `scripts/setup-nix-flakes-for-cc-remote.sh` | スクリプト実行 |

`nix profile` は通常のツール管理の主経路ではない。
`direnv` を daemonless Nix 環境で導入する補助用途と、home-manager へ移行済みパッケージの掃除に使う。
通常のパッケージ追加先は home-manager または mise である。

## source state と target state

`.chezmoiroot` は source state のルートとして `chezmoi/` を指定する。
`chezmoi/dot_claude/`、`chezmoi/dot_codex/`、`chezmoi/private_dot_pi/`、`chezmoi/private_dot_config/` などは、chezmoi が `$HOME` 以下へ配布するファイルのソースである。

`config/`、`internal/`、`shell/`、`scripts/` は source state そのものではない。
ただし、`shell/` と `internal/` はターゲット環境で実行されるため、設定変更時には内容と実行経路を合わせて確認する。

## 設定変更の完了条件

設定変更は、ファイルを書き換えただけでは完了しない。
変更した設定の配布経路を更新し、対象環境に反映し、必要な検証を終える。

| 変更対象 | 必要な反映 |
| --- | --- |
| `chezmoi/` | `chezmoi apply` |
| home-manager の Nix 設定 | `chezmoi apply` の後に `home-manager switch` |
| mise 設定 | `chezmoi apply` の後に `mise install && mise reshim`。通常は `home-manager switch` が実行する |
| `config/mcp.template.json` | `internal-cli mcp deliver` |
| `config/claude-settings.json` または `config/codex-config.toml` | `internal-cli merge-config` |
| `config/pi-agent/` または Pi のモデルプロファイル | `internal-cli pi-agent deliver` |

各コマンドの詳細は [コマンド](commands.md) を参照する。
