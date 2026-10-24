# `brew upgrade <formula>` が無関係な dependents もまとめて更新する

## Symptom

`brew upgrade ca-certificates` のように 1 つの formula だけを意図して実行しても、Homebrew はその formula に依存する outdated な dependents もまとめて `brew upgrade` する。

例: `brew upgrade ca-certificates` で curl、openssl@3、python@3.12、python@3.13、ansible、php、wget、qemu なども更新され、ansible の依存として python@3.14 が新規にインストールされた。

新規 formula のインストールで Homebrew の既定 python が切り替わった場合の副作用は `.agents/troubleshots/brew-default-python-symlink-switches.md` を参照。

## Workaround

依存元への影響を先に確認する。

```sh
HOMEBREW_NO_AUTO_UPDATE=1 brew upgrade --dry-run ca-certificates
```

dependents の更新を避けたい場合は `HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK=1` を付ける (`man brew` の同名セクション参照)。

```sh
HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK=1 brew upgrade ca-certificates
```

## Why Not Fixed

dependents の自動更新は Homebrew の既定動作。常に無効化すると dependents が outdated なまま残ったり linkage が壊れたりするため、`config/agent/claude-settings.json` の `env` に入れるかどうかは方針が未定。
