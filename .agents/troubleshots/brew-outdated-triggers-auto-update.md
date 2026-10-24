# `brew outdated` などの読み取りコマンドで Homebrew の自動更新が走る

## Symptom

調査目的で `brew outdated` や `brew info` を実行しただけで、Homebrew の auto-update (portable-ruby のダウンロードを含む) が始まり、時間がかかったりネットワークや書き込みを伴ったりする。

```console
$ brew outdated
==> Auto-updating Homebrew...
Adjust how often this is run with `$HOMEBREW_AUTO_UPDATE_SECS` or disable with
`$HOMEBREW_NO_AUTO_UPDATE=1`. Hide these hints with `$HOMEBREW_NO_ENV_HINTS=1` (see `man brew`).
```

## Workaround

状態を調べるだけのときは `HOMEBREW_NO_AUTO_UPDATE=1` を付けて実行する。

```sh
HOMEBREW_NO_AUTO_UPDATE=1 brew outdated
```

この場合、formula の情報は最後に `brew update` した時点のもので、最新ではない。最新の情報が必要なときだけ、意図して `brew update` を実行する。

## Why Not Fixed

Homebrew の仕様。`config/agent/claude-settings.json` の `env` に `HOMEBREW_NO_AUTO_UPDATE=1` を入れればエージェントの Bash では抑止できるが、エージェントが行う `brew install` でも formula が古いままになるため、入れるかどうかは方針が決まっていない。
