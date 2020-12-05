# Dotfiles

シェル周りの設定リポジトリ、`$HOME/dotfiles` に設置してシンボリックリンクを貼ることで適用できる

## 構成

| ファイル/ディレクトリ | 用途                                                         |
| :------------------- | :----------------------------------------------------------- |
|        .zshrc         | シェル周りの設定                                             |
|       .commands       | [エイリアス & Fuctions](https://github.com/d-kimuson/commands) |
|      .commandsrc      | `.commands` の読み込み                                       |

## 新しい端末にセットアップする

まずは、既に端末に置かれている固有の設定ファイルのうち、このリポジトリで管理するもの(`Makefile` の `targets`参照)をバックアップして削除する

``` bash
$ cd $HOME
$ mkdir backup && mv .zshrc backup  # 管理対象の設定ファイルをすべて移動する
```

あとは、

``` sh
$ git clone git@github.com:d-kimuson/dotfiles.git dotfiles
$ cp ~/backup/.zshrc ~/dotfiles/.localrc  # 端末の設定をコピーする
$ cd dotfiles & make setup
```

で設定が適用される

## リポジトリの変更を適用する

``` sh
$ make pull
```

`.commands` の更新もこれで行う

## 新しい設定ファイルをリンクする

1. 設定ファイルを `dotfiles` 下に置く
2. `Makefile` の `targets` にファイルを追加する
2. `$ make link` する

次回起動のシェルから設定が適用される

## 既存の設定ファイルを削除する

- `$ make unlink` する
- 設定ファイルを `Makefile` の `targets` から削除する
- `$ make link` する

次回起動のシェルから設定が適用される

## リポジトリに載せない設定を書く

認証情報や、端末固有のパスなどの情報は、`.localrc` に記述する
