# pueue status にタスク ID を渡すと Failed to parse query になる

## Symptom

`pueue status` の引数はタスク ID ではなくクエリ文字列なので、ID をそのまま渡すと終了コード 1 で失敗し、状態を表示しない。

```console
$ pueue status 743
Error:
   0: Failed to parse query
   1:  --> 1:1
        |
      1 | 743
        | ^---
        |
        = expected query
```

## Workaround

タスク 1 つ分は `pueue log <task-id>` で確認する。状態、終了コード、出力がまとめて出る。
全タスクの一覧が要るときは ID を渡さずに `pueue status` を実行する。

## Why Not Fixed

`pueue status` の引数は `status = running` のようなクエリで、ID 指定は構文にない (pueue の仕様)。
