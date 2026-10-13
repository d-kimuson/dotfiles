# サンドボックス内で pueue のコマンドが失敗する

## Symptom

Claude Code のサンドボックス内で `pueue` のコマンド (`pueue add`/`pueue kill`/`pueue status` など) を実行すると、pueue daemon の unix socket への接続がブロックされて失敗する。

## Workaround

サンドボックスの外で実行する。

## Why Not Fixed

unix socket への接続許可範囲はこのリポジトリの外 (Claude Code の sandbox 設定) で決まる。
