---
description: 'chezmoi diff の差分を chezmoi ソースに反映し apply 可能にする'
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash(chezmoi:*), Read, Edit, Write
---

`chezmoi diff` の差分を chezmoi ソース側に反映し、`chezmoi diff` が空になる状態にする。

## 手順

1. `chezmoi diff --no-pager` を実行し、差分のあるターゲットパス一覧を取得する
2. 差分がなければ「差分なし」と報告して終了
3. 各ターゲットパスについて以下を実行:
   a. `chezmoi source-path <target>` でソースファイルパスを取得
   b. ソースが `.tmpl` ファイルかどうかを判定

### 非テンプレートファイルの場合

ターゲット（`$HOME` 側）の内容をソースファイルにコピーする。

### テンプレートファイル（`.tmpl`）の場合

テンプレート構文（`{{ }}` ブロック）を壊さないよう、以下の手順で対応する:
- ソースファイルとターゲットファイルの両方を Read で読む
- diff の内容を参考に、ソースファイルのテンプレート構文を保持しつつ該当箇所を Edit で更新する

## 完了確認

全ファイルの反映後、`chezmoi diff --no-pager` を再実行し差分が空であることを確認する。
差分が残っている場合は再度修正を試みる。

## 注意事項

- `chezmoi apply` は実行しない（ソース側の修正のみ行う）
- テンプレート構文の破壊は絶対に避ける
