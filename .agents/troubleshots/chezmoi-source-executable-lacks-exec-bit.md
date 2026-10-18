# chezmoi source state の executable_ ファイルは配布前に直接実行できない

## Symptom

`chezmoi/` 配下の `executable_*` ファイルを、`chezmoi apply` で配布する前に source state 上のパスから直接実行すると `Permission denied` になる。
`executable_` は chezmoi が配布時に付与する属性であり、source state 上のファイル自体には実行ビットが立っていない。

## Workaround

配布前に動作確認するときは `bash <path-to-executable_file>` のように、実行ビットを前提しない方法で起動する。

## Why Not Fixed

`executable_` 属性が source state ではなく配布先 (target state) に対して実行ビットを付与する仕様は chezmoi 側の設計。
