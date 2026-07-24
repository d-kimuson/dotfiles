# コマンド

## エージェントが設定変更を反映するとき

`dotfiles-apply`、`reload`、`reload-force` は `chezmoi/private_dot_config/zeno/config.yml` に定義された zeno abbreviation である。
通常の非対話シェルではコマンドとして実行できない。
エージェントは abbreviation を使わず、変更内容に対応するコマンドを個別に実行する。

| 変更内容 | 実行するコマンド |
| --- | --- |
| chezmoi の source state | `chezmoi diff`、`chezmoi apply`、`chezmoi verify` |
| home-manager の設定 | `chezmoi apply`、`home-manager switch` |
| mise の設定のみ | `chezmoi apply`、`mise install && mise reshim` |
| Claude Code / Codex のマージ設定 | `node internal/src/cli.ts merge-config` |
| Pi の生成設定 | `node internal/src/cli.ts pi-agent deliver` |
| MCP の共通設定 | `node internal/src/cli.ts mcp deliver` |

この working tree は `~/.local/share/chezmoi` に置かれる前提である。
`internal-cli` の実装はこのパスを source root として参照する。
作業中の checkout がそのパスでない場合、対象マシンの設定を誤って別の source state から生成しないよう、配布コマンドを実行する前に確認する。

## ユーザー向け abbreviation

対話 zsh では次の abbreviation を利用できる。

| abbreviation | 展開内容 |
| --- | --- |
| `dotfiles-apply` | `chezmoi apply --no-tty --keep-going`、`envrc.sh` の読み込み、`home-manager switch`、`sharedrc.sh` の読み込み、Pi 設定配布、Claude/Codex 設定マージ |
| `reload` | `chezmoi apply`、`home-manager switch`、`sharedrc.sh` の読み込み |
| `reload-force` | `chezmoi apply`、`home-manager switch`、ログインシェルの再起動 |

`dotfiles-apply` は MCP 設定を配布しない。
MCP 定義を変えた場合は `internal-cli mcp deliver` を追加で実行する。

## 初期セットアップ

新しいマシンでは次を実行する。

```bash
bash -c "$(curl -fsLS https://raw.githubusercontent.com/d-kimuson/dotfiles/refs/heads/main/scripts/setup.sh)"
```

`scripts/setup.sh` は chezmoi と Nix を導入し、リポジトリを `chezmoi init --apply` で配布してから、home-manager を実行する。
完了後は `exec $SHELL -l` で新しいシェル設定を読み込む。

Nix daemon を使えないリモート環境では `scripts/setup-nix-flakes-for-cc-remote.sh` を使う。

## 更新

```bash
./scripts/update.sh
```

このスクリプトは Nix を利用可能にしてから、chezmoi apply、flake update、移行済みの nix profile パッケージ削除、home-manager switch、mise 対象 CLI の更新、mise 設定の source state への同期、reshim を実行する。

## 検証

- chezmoi の配布結果：`chezmoi verify`
- MCP 配布ロジック：`npx vitest run internal/src/mcp/deliver.test.ts`
- Claude/Codex のマージロジック：`npx vitest run internal/src/merge-config/merge.test.ts`
- Pi 設定配布ロジック：`npx vitest run internal/src/pi-agent/deliver.test.ts`
- すべての配布前確認：各 `internal-cli` の `--dry-run`
