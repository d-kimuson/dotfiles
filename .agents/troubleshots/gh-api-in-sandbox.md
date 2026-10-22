# サンドボックス内で `gh api` が TLS 証明書エラーで失敗する

## Symptom

Claude Code のサンドボックス内で `gh api` を実行すると証明書検証で失敗する。サンドボックス外では同じコマンドが成功する。

```
tls: failed to verify certificate: x509: OSStatus -26276
```

## Workaround

サンドボックスの外で実行する。

## Why Not Fixed

証明書検証に使うプロセスへのアクセス範囲はこのリポジトリの外 (Claude Code の sandbox 設定) で決まる。
