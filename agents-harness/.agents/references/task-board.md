# Task Board

本人のタスクを 1 つに集める Personal Task Board の読み書きの仕方。盤面は Claude Artifact のページで、読み書きに `Artifact` と `ArtifactData` ツールを使うので、Claude Code からだけ扱える。

## 置き場所

- `~/.agents/state/task-board/index.md`: マシンごとの入口。Git 管理外。形式は下の「index.md」
- Artifact: dev-process-kit の Kanban。ページの HTML は `~/.agents/playbooks/personal-task-board/assets/board.html` で、カードを持たない
- カードの正: Artifact の db の `actions` コレクション。1 文書が dev-process-kit の draft action 1 つ (`ADD_CARD`、`MOVE_CARD`、`SET_CARD_DESCRIPTION`、`comment` など)。ページはこれを順に再生して盤面を描き、本人がページで編集した分も同じコレクションに入る

action を追記するだけで既存の文書を書き換えないので、別々のセッションが同時に別のカードを更新しても、互いの更新は消えない。

## index.md

```markdown
# Task Board

- url: https://claude.ai/artifact/<id>
```

`url` の行だけを読む。ほかの行は本人のメモとして残す。

## index.md が無いとき

1. `Artifact` の `list` で `Personal Task Board` という題の Artifact を探す。あれば、その URL で index.md を書く
2. 無ければ `board.html` を `capabilities: {"comments": {}, "db": {}, "user": {}}` で publish し (共有範囲は既定の非公開のまま)、返った URL で index.md を書く

## 読む

1. 空のディレクトリ `<dir>` を作り (`mktemp -d`)、`ArtifactData` の `list` を `url` に盤面の URL、`collection: "actions"`、`query: {"limit": 1000}`、`out_dir: <dir>` で呼ぶ。`next_cursor` が返る間は `query.cursor` に渡して同じ `out_dir` へ続けて読む
2. `node ~/.agents/playbooks/personal-task-board/scripts/board.ts show <dir>` で列ごとのカードを出す。カードの行は `TASK-<n> <カード id> <題> [タグ] <リンク>`、続く字下げ行が description と、ページで本人が付けたコメント (`>` の行)。列などカード以外に付いたコメントは「カード以外へのコメント」の節に出る

`<dir>/actions` が無いと `board.ts` は失敗する。`list` が 0 件で盤面が空のときだけ、`show` と `plan` に `--empty` を付ける。

毎回新しい `<dir>` に読む。前回の読み込みが残ると、消えた action を読んでしまう。

## 書く

1. 上の「読む」で盤面を読む
2. 変更を intents の JSON 配列でファイルに書く
3. `node ~/.agents/playbooks/personal-task-board/scripts/board.ts plan <dir> <intents.json> <out-dir>` を実行する。標準出力は `ArtifactData` の `batch` 1 回分ずつの `writes` の配列なので、1 つずつ `batch` に渡す。`skip:` の行は書かなかった intent とその理由
4. もう一度読んで、変更が盤面に出たことを確かめる

| intent | すること |
| --- | --- |
| `{"op":"add","key":k,"column":c,"title":t,"detail"?:d,"note"?:n,"tags"?:[..],"links"?:[{"url","label"?}]}` | カードを積む。カード id は `key` から決まり、同じ `key` のカードがあれば積まない |
| `{"op":"status","key"?:k,"card"?:id,"column"?:c,"note":n}` | 列を移し、description の `## 状況` に日時つきの行を足す |
| `{"op":"detail","key"?:k,"card"?:id,"text":t}` | description の詳細 (`## 状況` より前) に段落を足す |
| `{"op":"link","key"?:k,"card"?:id,"url":u,"label"?:l}` | リンクを足す |

- `key`: チケットがあればその URL。無ければ出どころが分かる一意な文字列 (`slack:<channel>/<スレッドの親の ts>`、`session:<handoff の identifier>` など)。URL の key は host の大小・fragment・末尾の `/` をそろえてからカード id にする。本人がページで足したカードは `card` に `board.ts show` のカード id を渡す
- 列: `todo` (これからやる)、`doing` (作業中)、`blocked` (止まっている)、`done` (完了)、`learning-backlog` (学習。retro が積む)。列がステータスである
- `links` は `http(s)` の URL だけ。ローカルのパスは `detail` に書く
- タグは種類 (`判断`・`学習`・`作業` から 1 つ) と、プロジェクトに属すならプロジェクト名 (remote のリポジトリ名、無ければディレクトリ名)

## Claude Code セッションの更新

着手中のタスクのカードを、次の要所で更新する。

| 要所 | intent |
| --- | --- |
| 着手 | カードが無ければ `add` (`column: "doing"`, `note: "着手"`)。あれば `status` で `doing` へ |
| 方針の確定 | `detail` に決めた方針を 1〜3 行 |
| ブロック | `status` で `blocked` へ。`note` に何を待っているか |
| ブロックの解消 | `status` で `doing` へ |
| 完了 | `status` で `done` へ。`note` に成果物 (PR やコミット) |

- 着手の前に盤面を読み、同じタスクのカード (チケットの URL のリンク、似た題) があればそれを使う。収集役が先に積んでいることがある
- カードの `key` は、チケットがあればその URL、無ければ `session:<handoff の identifier>`。使うカード id は handoff ファイルに書き、以降の更新で同じカードを使う
- 質問への回答や短い調査など、作業を伴わないセッションでは更新しない

## 本人がページで書いたもの

ページでのカードの追加・移動・編集・コメントは db の `actions` に入るので、上の「読む」で読める。コメントは本人から Agent への依頼やメモとして扱う。

ページが db から消すのは、そのページを開いてから本人が足した action (Undo の対象) とコメントだけである。操作ログの「すべてクリア」と、それ以前の action の削除は db に反映せず、盤面は db の内容に戻る。

## 同時更新

- 別々のカードへの同時の更新は、どちらも残る
- 同じカードの description を 2 者が同時に書き換えると、後に書いた方が残る (`status` と `detail` は読んだ時点の description に行を足して全体を書き換える)。本人がページで description を編集している間に Agent が同じカードに書いた行も、本人の確定で消える
- 書いた後に読み直し、自分の行が消えていたら同じ intent を書き直す

## 盤面を更新できないとき

`ArtifactData` が無い、または書き込みに失敗したときは、本人に 1 回だけ伝えて本筋の作業を続ける。
