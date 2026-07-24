# chezmoi の運用

## 編集規約

chezmoi が管理するターゲットファイルを直接編集しない。
`~/.zshrc`、`~/.config/**`、`~/.claude/**`、`~/.codex/**`、`~/.pi/**` などを変更する場合は、対応する `chezmoi/` 配下の source state を変更する。

このリポジトリを working tree として開いているときは `chezmoi/` を直接編集する。
稼働中のターゲットから変更を取り込むときは `chezmoi add`、`chezmoi re-add`、`chezmoi merge` を用途に応じて使う。
`chezmoi re-add` はテンプレートと併用できない。

`dot_`、`private_dot_`、`executable_`、`symlink_` などは source state attributes である。
属性を変更するときは命名規則を推測せず、`chezmoi chattr` と[公式リファレンス](https://www.chezmoi.io/reference/source-state-attributes/)を確認する。

## テンプレート

環境差分が必要なファイルだけを `.tmpl` にする。
テンプレートは Go `text/template` と Sprig 関数に基づく。

OS や配布版の分岐には `.chezmoi.os`、`.chezmoi.osRelease` などの chezmoi data を使う。
既存例は `chezmoi/dot_zshrc.tmpl` を参照する。

共有するテンプレート断片は `.chezmoitemplates/`、データ値は `.chezmoidata.{toml,yaml,json,jsonc}` または chezmoi 設定の `data` に置く。
テンプレートを変更したら `chezmoi execute-template` で評価できる。

## 秘密情報

秘密情報、トークン、秘密鍵、マシン固有の値を平文でコミットしない。
`config/*.local.json`、`shell/localrc.sh`、`shell/env-secrets.sh` は Git 管理外のローカル上書きである。

`shell/env-secrets.sh.tpl` は 1Password 参照を持つテンプレートである。
生成物をコミットしない。
chezmoi の source state に暗号化して保存する必要がある場合は `chezmoi add --encrypt` を使う。
新規の暗号化バックエンドには age を優先する。

## 変更から検証まで

1. source state を変更する。
2. `git diff --check` と `git diff` で変更内容を確認する。
3. `chezmoi diff` または `chezmoi apply --dry-run --verbose` で target state への影響を確認する。
4. `chezmoi apply` で target state を反映する。
5. 対象に応じて `home-manager switch`、`internal-cli` の配布コマンド、`mise install && mise reshim` を実行する。
6. `chezmoi verify` と対象アプリケーションの動作確認を行う。

実行コマンドと配布経路は [コマンド](commands.md) および [構成](overview.md) を参照する。
