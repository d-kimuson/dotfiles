# Dotfiles

シェル周りの設定リポジトリ、`$HOME/dotfiles` に設置してシンボリックリンクを貼ることで適用できる

## Installation

```bash
$ brew install gh
$ cd $HOME
$ git clone git@github.com:d-kimuson/dotfiles.git
$ ./scripts/install.sh
```

## Setup

```bash
$ mkdir backup && mv .zshrc backup
$ dotfiles_manager link
```

## リポジトリに載せない設定を書く

認証情報や、端末固有のパスなどの情報は、`.localrc` に記述する
