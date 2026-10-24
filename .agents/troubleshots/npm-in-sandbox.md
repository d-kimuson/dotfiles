# サンドボックス内で `npm view` が EPERM で失敗し、`sudo chown` を促される

## Symptom

Claude Code のサンドボックス内で `npm view <pkg>` などレジストリを引くコマンドを実行すると、キャッシュへの書き込みで失敗する。npm は root 所有のファイルが原因だと案内するが、実際の原因はサンドボックスの書き込み制限 (書き込めるのは `~/.npm/_logs` だけで、`~/.npm/_cacache` は書き込めない) である。

```
npm error code EPERM
npm error syscall mkdir
npm error path /Users/kaito/.npm/_cacache/tmp/...
npm error Your cache folder contains root-owned files, due to a bug in
npm error previous versions of npm which has since been addressed.
npm error To permanently fix this problem, please run:
npm error   sudo chown -R 501:20 "/Users/kaito/.npm"
```

## Workaround

`sudo chown` は実行しない (所有者は正しい)。

レジストリを直接引く。`dist-tags`、`bin`、`scripts`、`optionalDependencies` を読めば、mise の `allow_builds` が要るか (postinstall があるか) も判断できる。

```sh
curl -s https://registry.npmjs.org/<pkg> | python3 -c '
import json, sys
d = json.load(sys.stdin)
v = d["versions"][d["dist-tags"]["latest"]]
print(d["dist-tags"], v.get("bin"), v.get("scripts"), v.get("optionalDependencies"))
'
```

どうしても `npm` コマンドが必要なら、サンドボックスの外で実行する。

## Why Not Fixed

サンドボックスの書き込み許可範囲はこのリポジトリの外 (Claude Code の sandbox 設定) で決まる。`~/.npm/_cacache` を許可すると、サンドボックス外のキャッシュ汚染を許すことになる。
