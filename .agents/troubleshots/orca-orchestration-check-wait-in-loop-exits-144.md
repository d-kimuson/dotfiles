# `orca orchestration check --wait` を回す bash のループを pkill すると exit 144 で止まる

## Symptom

次のように `orca orchestration check --wait` を bash のループで回し、待ちを打ち切ろうとしてループを `pkill` すると、ループが exit 144 で終わり、待ちを張り直さない。

```sh
while :; do
  orca orchestration check --terminal "$T" --wait --timeout-ms 900000 --json
done
```

```console
$ pkill -f "orca orchestration check --wait"
$ wait $LOOP_PID; echo $?
144
```

`orca` 自身を `kill` したときは 143 で終わるので、144 はループ側で起きる。

## Workaround

`--wait` は 1 回だけバックグラウンドに置き、`timedOut: true` が返ったときに張り直す。ループごと `pkill` しない。

```sh
orca orchestration check --wait --timeout-ms 540000 --json > /tmp/check.json 2>/tmp/check.err &
CHECK_PID=$!
```

`--wait` は 15 秒ごとに keepalive の JSON を stderr に出す。stdout と stderr をまとめて読むときは `jq 'select(._keepalive|not)'` で落とす。

## Why Not Fixed

`--wait` を持つ Orca CLI のプロセス管理の挙動で、このリポジトリからは変えられない。待ち方を 1 回のバックグラウンド実行にするだけで足りるので、手順の変更は要らない。
