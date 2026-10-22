# Homebrew の既定 python が切り替わると python3/pip3 の無印 symlink が外れる

## Symptom

`brew upgrade`/`brew install` で Homebrew の既定 python (`python`/`python3`/`python@3` のエイリアス先、例: python@3.13 → python@3.15) が切り替わると、それまで無印の `python3`/`pip3` を提供していた旧バージョンの symlink が外れる。

```console
$ which python3
/usr/bin/python3
```

## Workaround

既定 python の formula を入れるか、使いたいバージョンの `libexec/bin` を PATH の先頭に足す。バージョン付きの formula の bin には無印の名前がないため、`brew link` では戻らない。

```sh
brew install python3
# または
export PATH="$(brew --prefix python@3.13)/libexec/bin:$PATH"
```

## Why Not Fixed

バージョン付きの formula (`python@3.13` など) は既定 python でない限り、無印の bin を `$(brew --prefix python@3.x)/libexec/bin` にしか置かない。`/opt/homebrew/bin/python3` のような無印 symlink は既定 python の formula だけが持つ、Homebrew の仕様。
