# `sed -i ''` が「can't read ... No such file or directory」で失敗する

## Symptom

macOS 向けの書き方 `sed -i '' 's/a/b/' file` を実行すると、置換式をファイル名として読もうとして失敗する。

```
sed: can't read s|...|...|: No such file or directory
```

PATH 上の `sed` は home-manager が入れた GNU sed (`~/.nix-profile/bin/sed`) で、`/usr/bin/sed` (BSD sed) より先に見つかる。GNU sed の `-i` は直後の引数をサフィックスとして取らない。

## Workaround

GNU sed の書き方で `sed -i 's/a/b/' file` とする。複数行の置換や日本語を含む置換は、node のスクリプトで読み書きする。

## Why Not Fixed

GNU sed は意図して入れているツールで、外す理由がない。
