# Chrome 起動中に History の sqlite3 が database is locked になる

## Symptom

Chrome が起動している間、履歴 DB を直接開くと失敗する。`-readonly` を付けても同じ。

```
$ sqlite3 -readonly "$HOME/Library/Application Support/Google/Chrome/Default/History" "select count(*) from urls;"
Error: in prepare, database is locked (5)
```

## Workaround

DB と WAL を一時ディレクトリへコピーしてから開く。コピーした DB は書き換わらないため、調査中も Chrome を起動したままでよい。

```sh
tmp=$(mktemp -d)
for f in History History-wal History-journal; do
  cp "$HOME/Library/Application Support/Google/Chrome/Default/$f" "$tmp/" 2>/dev/null
done
sqlite3 -readonly "$tmp/History" \
  "select datetime(last_visit_time/1000000-11644473600,'unixepoch','localtime'), url, title from urls order by last_visit_time desc limit 30;"
rm -rf "$tmp"
```

`last_visit_time` は 1601 年起点のマイクロ秒なので、上記の式で現地時刻に直す。
History だけをコピーすると、最新の訪問が WAL に残っていて読めないため `History-wal` も一緒にコピーする。
Profile が `Default` でない場合は `Profile 1` などに置き換える。Chromium 系のブラウザも同じ構成である。

## Why Not Fixed

Chrome が起動中に DB の排他ロックを保持するため。ロックを避けて開く方法はなく、Chrome を終了するかコピーするかしかない。
調査では Chrome を閉じずに履歴を読みたいことが多いので、コピー手順をワークアラウンドとして残す。
