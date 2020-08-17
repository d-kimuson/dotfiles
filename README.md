# Dotfiles

環境周りの設定リポジトリ. zsh前提.

- .zshrc: シェル周りの設定
- .commandsrc: 自作エイリアス & Function 読み込み
- .commands: 自作エイリアス & Function 置き場([リポジトリ](https://gitlab.com/config-kimuemon/commands))

## Setup

``` sh
$ cd $HOME
$ git clone git@gitlab.com:config-kimuemon/dotfiles.git dotfiles
$ cd dotfiles & make setup
```

## Update

``` sh
$ make pull
```

## リポジトリに載せたくない

認証情報等を環境変数に置きたいときは, .env_variable.secret を時前で設置した上で,

``` sh
$ make link
```

する.
