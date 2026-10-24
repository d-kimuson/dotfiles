# minify されたバンドルへの `grep -o '.\{0,N\}PATTERN.\{0,N\}'` が complexity limits で失敗する

## Symptom

この環境の `grep` は ugrep で、巨大な 1 行ファイル (minify されたバンドルなど) に前後の文脈つきパターンを使うと失敗する。

```
ugrep: error ... exceeds complexity limits
```

## Workaround

python3 で正規表現を使い、一致位置の前後を切り出す。ダウンロードしたファイルを読むので `-I` を付け、スクリプトはファイルのあるディレクトリの外で実行する。

```sh
python3 -I -c '
import re, sys
s = open(sys.argv[1], errors="replace").read()
for m in re.finditer(sys.argv[2], s):
    print(s[max(0, m.start() - 250):m.end() + 250], "\n---")
' <file> '<PATTERN>'
```

## Why Not Fixed

ugrep の正規表現エンジンの上限であり、`{0,N}` の繰り返しを含むパターンは巨大な行に対して展開しきれない。
