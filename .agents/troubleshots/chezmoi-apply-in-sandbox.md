# サンドボックス内で chezmoi apply が失敗する

## Symptom

Claude Code のサンドボックス内で `chezmoi apply` を実行すると次のエラーで失敗する。

```
chezmoistate.boltdb: operation not permitted
```

`chezmoi apply` は永続状態ファイル (既定では `~/.config/chezmoi/chezmoistate.boltdb`、`--persistent-state` で変更可) に書き込む。このパスがサンドボックスの書き込み許可範囲外だと失敗する。

## Workaround

サンドボックスの外で実行する。

## Why Not Fixed

書き込み許可範囲はこのリポジトリの外 (Claude Code の sandbox 設定) で決まる。
