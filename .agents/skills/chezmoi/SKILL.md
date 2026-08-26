---
name: chezmoi
description: この dotfiles リポジトリで chezmoi、home-manager、mise、シェル設定を変更・検証・適用するときに使う。
disable-model-invocation: false
user-invocable: true
---

# chezmoi dotfiles の運用

このスキルは、このリポジトリの dotfiles を変更するときに使う。
常に **chezmoi の source state** を正とし、ターゲットファイルを直接編集しない。

## リポジトリ構造

- `.chezmoiroot` が source state のルートとして `chezmoi/` を指定する。
- `chezmoi/` 配下の `dot_`、`private_dot_`、`executable_`、`symlink_` などは chezmoi の source state attributes である。
  属性を変えるときは命名規則を手で推測せず、`chezmoi chattr` と公式リファレンスを確認する。
- `chezmoi/dot_claude/` は `~/.claude/`、`chezmoi/dot_zshrc.tmpl` は `~/.zshrc`、`chezmoi/private_dot_config/` は `~/.config/` に対応する。
- `shell/` は working tree に置く共有シェルスクリプトである。
  `.zshrc` は `shell/sharedrc.sh` を読み込み、`sharedrc.sh` は `shell/alias.sh` を読み込む。
  `shell/localrc.sh` は Git 管理しないマシン固有の上書き用である。
- `config/` は chezmoi のターゲットではない配布用設定、`scripts/` はセットアップ・保守スクリプト、`internal/` は設定を配布する TypeScript CLI である。

## このリポジトリでの編集規約

1. `~/.zshrc`、`~/.config/**`、`~/.claude/**` など、chezmoi 管理下のターゲットは編集しない。
   対応する `chezmoi/` のソースを編集する。
2. このリポジトリを checkout して作業するときは、`chezmoi/` を直接編集してよい。
   稼働中のターゲットから取り込む必要があるときは `chezmoi add`、`chezmoi re-add`、または `chezmoi merge` を用途に応じて使う。
   `re-add` はテンプレートと併用できない。
3. 対話的に source state を編集するだけなら `chezmoi edit <target>` も使える。
   テンプレート・暗号化ファイルを透過的に扱えるが、このリポジトリの変更として残すには Git diff を必ず確認する。
4. 新しい依存関係は、まず `nix search nixpkgs <package>` で nixpkgs を確認する。
   見つかった `legacyPackages.<system>.<name>` は通常 `pkgs.<name>` として `chezmoi/private_dot_config/home-manager/home.nix.tmpl` に追加する。
   npm のグローバルインストールや手動ダウンロードより home-manager を優先する。
5. Node.js などのランタイムバージョンは `chezmoi/private_dot_config/mise/config.toml` で管理する。

## Skill / Agent 設定を chezmoi で配布するときの注意

`chezmoi/dot_agents/skills/`、`chezmoi/dot_claude/`、`chezmoi/dot_codex/` 配下は chezmoi の source state である。
source state のルールがそのまま効くため、**普通のディレクトリのつもりでファイルを置くと配布されない**。

- **ドット始まりのファイル・ディレクトリは配布されない。**
  chezmoi は source state 内の `.` 始まりエントリを chezmoi 自身の特殊ファイル (`.chezmoiignore` など) として扱い、
  それ以外は無視する。`references/core/.envrc` のようにコミットしても `~/.agents/.../core/.envrc` は生成されない。
  Git 上には存在するので `ls` では気付けない。
  - dotfile を配布したい場合は `dot_` 属性を使う (`dot_envrc` → `.envrc`)。
  - **skill の reference テンプレート**は、そのまま使う dotfile ではなくコピー元なので、
    ドットなしの名前 (`envrc`、`oxfmtrc.json`、`agents/`) にして、コピー先を index.md に明記する方を優先する。
    配布後も可視ファイルとして残り、skill を使うエージェントが発見できる。
- `README` のような普通の名前でも、`.chezmoiignore` の対象に入っていないか確認する。
- 属性付きの名前 (`private_`、`executable_`、`symlink_`、`literal_` など) は意図せず解釈されることがある。
  ファイル名そのものを残したいときは `literal_` を使う。

`chezmoi verify` は「chezmoi が管理していると認識しているターゲット」しか見ないため、
無視されて配布されなかったファイルは検出できない。
ファイルを追加・リネームしたら、次の 2 つで確認する。

```bash
# 1. source state 内に配布されないドット始まりエントリがないか
find chezmoi -name '.*' -not -name '.chezmoi*'

# 2. 追加したファイルが管理対象に入っているか (出力があれば配布される)
chezmoi managed | grep '<配布先の相対パス>'
```

1 が何かを出力したら、意図的な chezmoi 特殊ファイルでない限りバグである。

## テンプレート

- 環境差分が必要な部分だけ `.tmpl` を使う。
  chezmoi のテンプレートは Go `text/template` と Sprig 関数に基づく。
- OS・配布版の条件分岐には `.chezmoi.os`、`.chezmoi.osRelease` などの chezmoi data を使う。
  既存例は `chezmoi/dot_zshrc.tmpl` を参照する。
- 変更が複数ファイルで共有されるなら `.chezmoitemplates/` に断片を置くことを検討する。
  データ値は `.chezmoidata.{toml,yaml,json,jsonc}` または chezmoi 設定の `data` に集約し、テンプレートへ値を散在させない。
- テンプレートを変更したら、必要に応じて `chezmoi execute-template` で評価する。
  `{{-` と `-}}` で意図しない空白・改行を除去できる。

## 秘密情報

- 秘密情報、トークン、秘密鍵、マシン固有値を平文でコミットしない。
  このリポジトリでは 1Password 参照を含む `shell/env-secrets.sh.tpl` があり、生成物は Git 管理外に置く。
- chezmoi に暗号化して保存する必要がある場合は `chezmoi add --encrypt` を使う。
  新規の暗号化バックエンドには age を優先し、復号・鍵管理・ローテーション方法を先に確認する。
- 秘密情報を含む変更は、適用前に `git diff --check` と `git diff` を必ず確認する。

## 変更・適用・検証の手順

1. source state を変更する。
2. `chezmoi diff` で target state と現在のターゲットとの差分を確認する。
   影響範囲を先に確認するだけなら `chezmoi apply --dry-run --verbose` を使う。
3. `chezmoi apply` で反映する。
   このリポジトリでは zeno の `dotfiles-apply` abbreviation が、`chezmoi apply --no-tty --keep-going`、環境変数の読み込み、`home-manager switch`、`internal-cli pi-agent deliver`、`internal-cli merge-config` を連結する。
   これは zsh/zeno の abbreviation であり、非対話シェルや CI でコマンドとして存在するとは限らない。
   必要な処理は個別コマンドとして明示して実行する。
4. 反映後は `chezmoi verify` で target state との一致を確認する。
   `chezmoi verify` は成功時に終了コード 0 を返すため、自動検証にも使える。
5. Nix の変更は `home-manager switch` の成否も確認する。
   シェル設定を変更した場合は、新しいログインシェルまたは `source` で読み込んだ後の動作も確認する。

`reload` は `chezmoi apply && home-manager switch && source ${CHEZMOI_WORKING_TREE}/shell/sharedrc.sh`、`reload-force` は最後に `exec $SHELL -l` を実行する zeno abbreviation である。

## 初期セットアップと CI

- 新しいマシンでは以下のセットアップスクリプトを使う。

  ```bash
  bash -c "$(curl -fsLS https://raw.githubusercontent.com/d-kimuson/dotfiles/refs/heads/main/scripts/setup.sh)"
  ```

- CI は Ubuntu 上で `chezmoi init --apply -S .` を実行する。
  Linux で成立しない macOS 固有の変更、秘密情報への依存、対話入力を必要とする変更を追加しない。

## 公式リファレンス

- [Concepts](https://www.chezmoi.io/reference/concepts/)
- [Daily operations](https://www.chezmoi.io/user-guide/daily-operations/)
- [Templating](https://www.chezmoi.io/user-guide/templating/)
- [Source state attributes](https://www.chezmoi.io/reference/source-state-attributes/)
- [Encryption](https://www.chezmoi.io/user-guide/encryption/)
- [diff](https://www.chezmoi.io/reference/commands/diff/)、[apply](https://www.chezmoi.io/reference/commands/apply/)、[verify](https://www.chezmoi.io/reference/commands/verify/)
