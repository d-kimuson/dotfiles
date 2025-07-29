# Dotfiles

シェル周りの設定リポジトリ、`$HOME/dotfiles` に設置してシンボリックリンクを貼ることで適用できる

## Installation

```bash
$ brew install gh
$ cd $HOME
$ git clone git@github.com:d-kimuson/dotfiles.git
```

## Setup

```bash
$ mkdir backup && mv .zshrc backup
$ ./scripts/sync.sh
```

## Alias Manager のビルド

Alias Manager を更新した場合は、以下のコマンドでビルドしてください：

```bash
$ cd alias-manager
$ pnpm i
$ pnpm build
```

ビルド成果物は `alias-manager/output/shell_aliases.sh` に生成され、`.zshrc` から読み込まれます。

> 注意: dotfiles setup 時（`sync.sh` 実行時）はビルドは実行されません。  
> 事前にコミットされたビルド成果物を使用するため、変更時は手動でビルドしてコミットしてください。

## リポジトリに載せない設定を書く

認証情報や、端末固有のパスなどの情報は、`.localrc` に記述する
