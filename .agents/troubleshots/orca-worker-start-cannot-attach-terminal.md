# Orca の worker から worker-start に terminal を渡すと invalid_argument になる

## Symptom

Orca の worker として動いているセッションが、`agents-harness/.agents/references/agent-call-over-cli.md` の「worker でないセッションから呼ぶ」の手順で terminal を作り、その handle を `orca orchestration worker-start` に渡すと、次のエラーで何も起きない。

```console
$ orca orchestration worker-start --terminal term_e397a3a6-fec2-41fe-9190-a0bbc8a99958 --worktree current --spec-file /tmp/advise-req-1.md --json
{"ok":false,"error":{"code":"invalid_argument","message":"A worker starts helpers in a new agent on this host; omit --on and --terminal. No effects were applied. Orchestration mutation request ID: 6d28061f-15d5-4ef2-a0d4-7c211b8485e6."}}
```

## Workaround

worker からは、起動する agent とモデルを直接指定する。terminal を先に作らない。

```sh
orca orchestration worker-start --agent claude --model claude-fable-5-2 --effort xhigh --worktree current --spec-file <path> --json
```

応答の `result.terminal` が新しい terminal の handle になる。先に作ってしまった terminal は `orca terminal close --terminal <T> --json` で閉じる。

## Why Not Fixed

worker が helper を起動するときに `--terminal` と `--on` を受け付けないのは Orca の仕様で、このリポジトリからは変えられない。worker 用の手順は `agents-harness/.agents/references/agent-call-over-cli.md` の「Orca の worker から呼ぶ」にあり、worker はそちらに従う。
