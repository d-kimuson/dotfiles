# gpg の古いロックで mise install (node の署名検証) が失敗する

## Symptom

`mise install` が node の GPG 署名検証で次のエラーを出して失敗する。

```
gpg: Note: database_open ... waiting for lock (held by <pid>)
gpg: error writing keyring '[keyboxd]': SQL library used incorrectly
mise ERROR gpg failed
```

`~/.gnupg/public-keys.d/pubring.db.lock` と `.#lk0x...<host>.<pid>` が、数か月前に終了した PID のロックファイルとして残っている。

## Workaround

1. `ps -p <pid>` でそのプロセスが存在しないことを確認する。
2. `gpgconf --kill keyboxd` を実行する。
3. `~/.gnupg/public-keys.d/pubring.db.lock` と `.#lk0x...<host>.<pid>` を削除する。
4. `mise install` を再実行する。

## Why Not Fixed

gpg/keyboxd がプロセス終了時にロックファイルを確実に消さないのは外部ツール (GnuPG) の挙動であり、このリポジトリ側では直せない。
