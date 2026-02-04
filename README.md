# dotfiles

**chezmoi** と **home-manager (Nix)** ベースで構築された個人用dotfiles.

- chezmoi:
  - 設定ファイル(~/.zshrc, ...etc)をリポジトリ管理
- home-manager:
  - Nixでグローバルに追加するツールを管理

## ディレクトリ構造

```
.chezmoiroot           # chezmoi/ をソースディレクトリとして指定
chezmoi/               # chezmoi 以下が同期される設定ファイル群
  dot_claude/          # → ~/.claude
  dot_zshrc.tmpl       # → ~/.zshrc
  private_dot_config/  # → ~/.config/
    home-manager/      # home-manager 設定
shell/                 # 共有シェルスクリプト (.zshrc から読み込み)
scripts/               # セットアップ・メンテナンス用スクリプト
config/                # $HOME 以下に同期はしない設定ファイル (starship, MCP)
```

## セットアップ

```bash
bash -c "$(curl -fsLS https://raw.githubusercontent.com/d-kimuson/dotfiles/refs/heads/main/scripts/setup.sh)"
```

上記を実行することで

1. chezmoi がインストールされ、設定が配布される
2. Nix & home-manager がインストールされる
3. home-manager によって各種ツールがインストールされる

の流れでセットアップが完了。

```bash
exec $SHELL -l
```

でシェル設定も読み込んでおく。

## メンテナンス

### 設定を反映したい

```bash
./scripts/reload.sh
```

chezmoi apply + home-manager switch + シェル再読み込みが実行される。

### 環境固有の設定を追加したい

shell/localrc.sh を追加し、環境変数等追加したい設定を記載

```bash:shell/localrc.sh
export TERM=xterm-256color
```
