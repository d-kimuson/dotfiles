# エージェントの Bash で `find /` が終わらない

## Symptom

Claude Code の Bash ツールで、`find / -name node_modules -prune -o ...` のようにルートからフルディスク走査をすると、何時間も (実例では 1 時間 49 分) 終わらない。`-prune` で除外したつもりのディレクトリも歩いているように見える。

Bash ツールのシェルでは `find` は `/usr/bin/find` ではなく、Claude Code が shell snapshot (`~/.claude/shell-snapshots/`) に注入する関数になっている。この関数は Claude Code 本体に内蔵された `bfs` を `ARGV0=bfs` で呼ぶ。

```console
$ type find
find is a shell function from /Users/<user>/.claude/shell-snapshots/snapshot-zsh-....sh
```

このリポジトリの `shell/` や zabrze の設定に `find` の alias はない。原因はこのリポジトリの設定ではない。

## Workaround

- ルートからの走査をしない。対象ディレクトリを絞ってから `find` する (絞ったら 1 分で終わった)。
- 走査が必要なら `/usr/bin/find` を絶対パスで明示する。`command find` でも関数は回避できるが、Nix の `find` (`~/.nix-profile/bin/find`) が先に解決される場合があるため、挙動を揃えたいなら `/usr/bin/find` を使う。
- 名前だけで探すなら、`find` の代わりに Grep/Glob ツールか `fd` を使う。
- 長くなりそうな走査は `timeout` を付けるか、`run_in_background` で実行する。

## Why Not Fixed

`find` を内蔵 `bfs` に差し替えるのは Claude Code の shell snapshot の仕組みで、このリポジトリからは無効化できない (無効化する設定も確認できなかった)。
