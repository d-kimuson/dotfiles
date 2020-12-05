# Dotfiles

My dotfiles.

## 構成

| ファイル/ディレクトリ | 用途                                                         |
| :-------------------: | :----------------------------------------------------------- |
|        .zshrc         | シェル周りの設定                                             |
|       .commands       | [エイリアス&Fuctions](https://github.com/d-kimuson/commands) |
|      .commandsrc      | `.commands` の読み込み                                       |

## Setup

``` sh
$ cd $HOME
$ git clone git@github.com:d-kimuson/dotfiles.git dotfiles
$ cd dotfiles & make setup
```

## Update

``` sh
$ make pull
```

## リポジトリに載せたくない設定

認証情報や、端末固有のパスなどの情報は、`.localrc` に記述した上で

``` sh
$ make link
```

する.
