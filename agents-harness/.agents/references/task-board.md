# Task Board

本人のタスクを 1 つに集める Personal Task Board の読み書きの仕方。盤面は「パーソナルダッシュボード」という題の Claude Artifact のページで、読み書きに `Artifact` と `ArtifactData` ツールを使う。ローカルの Claude Code と Claude Code on the web のどちらでも同じ手順で扱える。

## 置き場所

- `~/.agents/state/task-board/index.md`: マシンごとの入口。Git 管理外。形式は下の「index.md」
- Artifact: dev-process-kit の Kanban。ページの HTML は `~/.agents/playbooks/personal-task-board/assets/board.html` で、カードを持たない。ページは 2 つある
  - `タスク` (盤面 `personal-task-board`): 列は `todo` (Todo)、`today` (今日やる)、`doing` (進行中)、`blocked` (ブロック)、`done` (Done)
  - `学習バックログ` (盤面 `personal-learning`): 列は `backlog` (バックログ)、`done` (Done)。retro が積む
  - どちらの盤面にも、ページが隠す最後の列 `archived` (アーカイブ) がある。下の「アーカイブ」で Done のカードを移す先である
- カードの正: Artifact の db の `actions` コレクション。1 文書が dev-process-kit の draft action 1 つ (`ADD_CARD`、`MOVE_CARD`、`SET_CARD_DESCRIPTION`、`comment` など)。ページはこれを順に再生して盤面を描き、本人がページで編集した分も同じコレクションに入る

Agent は `actions` に文書を追記するだけで、既存の文書を書き換えも削除もしない。別々のセッションが同時に別のカードを更新しても、互いの更新は消えない。

## index.md

```markdown
# Task Board

- url: https://claude.ai/artifact/<id>
```

`url` の行だけを読む。ほかの行は本人のメモとして残す。

## index.md が無いとき

Claude Code on the web では毎回これにあたる。

1. `Artifact` の `list` で `パーソナルダッシュボード` という題の Artifact を探す (以前の題は `Personal Task Board`)。あれば、その URL で index.md を書く。同じ題が複数あれば、`ArtifactData` の `list` (`collection: "actions"`) で文書が返るものを選び、複数返れば最も新しく更新されたものを選ぶ
2. 無ければ `board.html` を `capabilities: {"comments": {}, "db": {}, "user": {}}` で publish し (共有範囲は既定の非公開のまま)、返った URL で index.md を書く

## 読む

1. 空のディレクトリ `<dir>` を作り (`mktemp -d`)、`ArtifactData` の `list` を `url` に盤面の URL、`collection: "actions"`、`query: {"limit": 1000}`、`out_dir: <dir>` で呼ぶ。`next_cursor` が返る間は `query.cursor` に渡して同じ `out_dir` へ続けて読む
2. `node ~/.agents/playbooks/personal-task-board/scripts/board.ts show <dir>` で盤面ごと・列ごとのカードを出す。カードの行は `TASK-<n> <カード id> <題> [タグ] <リンク>`、続く字下げ行が description と、カードのコメント (`> <日時> <書き手>: <本文>` の行、古い順)。列などカード以外に付いたコメントは「カード以外へのコメント」の節に出る
3. `show` はアーカイブの列を枚数だけ出す。アーカイブしたカードの中身は `show <dir> --archived` で出す

`<dir>/actions` が無いと `board.ts` は失敗する。`list` が 0 件で盤面が空のときだけ、`show` と `plan` に `--empty` を付ける。

毎回新しい `<dir>` に読む。前回の読み込みが残ると、消えた action を読んでしまう。

## 書く

1. 上の「読む」で盤面を読む
2. 変更を intents の JSON 配列でファイルに書く
3. `node ~/.agents/playbooks/personal-task-board/scripts/board.ts plan <dir> <intents.json> <out-dir>` を実行する。標準出力は `ArtifactData` の `batch` 1 回分ずつの `writes` の配列なので、1 つずつ `batch` に渡す。`skip:` の行は書かなかった intent とその理由
4. もう一度読んで、変更が盤面に出たことを確かめる

| intent | すること |
| --- | --- |
| `{"op":"add","key":k,"board"?:b,"column":c,"title":t,"detail"?:d,"reason"?:r,"tags"?:[..],"links"?:[{"url","label"?}],"sessions"?:[s]}` | カードを積む。カード id は `key` から決まり、同じ `key` のカードがあれば積まない。`board` の既定は `personal-task-board` |
| `{"op":"move","key"?:k,"card"?:id,"column":c,"reason"?:r}` | 列を移す。`blocked` へは `reason` (何を待っているか) が要り、description の `## ブロック理由` になる。`blocked` から出すと `## ブロック理由` を消す |
| `{"op":"detail","key"?:k,"card"?:id,"text":t}` | description の説明に段落を足す |
| `{"op":"link","key"?:k,"card"?:id,"url":u,"label"?:l}` | リンクを足す。成果物 (PR やコミット) もここに置く |
| `{"op":"session","key"?:k,"card"?:id,"session":s}` | セッションの参照を足す。形式は下の「セッションの参照」 |
| `{"op":"comment","key"?:k,"card"?:id,"text":t}` | カードにコメントを足す。状況・方針・進み具合はここに書く。書き手は `Claude Code` と出る |
| `{"op":"archive","board"?:b}` | Done のカードを `archived` へ移す。下の「アーカイブ」と同じ。`board` を省くと全盤面 |

- `key`: チケットがあればその URL。無ければ出どころが分かる一意な文字列 (`slack:<channel>/<スレッドの親の ts>`、`session:<handoff の identifier>` など)。URL の key は host の大小・fragment・末尾の `/` をそろえてからカード id にする。本人がページで足したカードは `card` に `board.ts show` のカード id を渡す
- 列は上の「置き場所」のとおり。`today` は本人が選ぶ列で、Agent はカードを `today` へ動かさない。`today` にあるカードの着手は `doing` へ動かす
- `links` は `http(s)` の URL だけ。ローカルのパスは `detail` に書く
- タグは種類 (`判断`・`学習`・`作業` から 1 つ) と、プロジェクトに属すならプロジェクト名 (remote のリポジトリ名、無ければディレクトリ名)
- description は説明、`## ブロック理由`、`## セッション` の 3 節だけにする。経緯と状況は `comment` に書く。いまの状態は列が表す

## セッションの参照

カードには、そのタスクを進めたセッションの参照を 1 つ以上付ける。自分の参照は `node ~/.agents/playbooks/personal-task-board/scripts/board.ts session` で出し、`session` に渡す。

| セッション | 出る参照 |
| --- | --- |
| Claude Code on the web | `https://claude.ai/code/session_<id>` |
| ローカルの Claude Code | `claude-code <session id>` |
| Codex | `codex <thread id>` |
| Pi | `pi <session id>` |
| Command Code | `command-code <session id>` |

`board.ts session` が失敗する (セッションを見分ける環境変数が無い) ときは、参照を付けずに進める。

URL はリンク (label `session`) に、ローカルの参照は description の `## セッション` に 1 行ずつ入る。同じ参照は 2 度付かない。セッションログから参照を作るときは、ログのファイル名の末尾の UUID が session id である (`retro/scripts/sessions.ts` は `session: <provider> <id>` の行で出す)。

## Claude Code セッションの更新

着手中のタスクのカードを、次の要所で更新する。

| 要所 | intent |
| --- | --- |
| 着手 | カードが無ければ `add` (`column: "doing"`, `sessions: [自分の参照]`)。あれば `move` で `doing` へ動かし、`session` で自分の参照を足す |
| 方針の確定 | `comment` に決めた方針を 1〜3 行 |
| 状況の変化 (区切りの作業が済んだ、委譲した、レビューを待つなど) | `comment` に 1〜3 行 |
| ブロック | `move` で `blocked` へ。`reason` に何を待っているか |
| ブロックの解消 | `move` で `doing` へ |
| 完了 | `move` で `done` へ。成果物 (PR やコミット) を `link` で足す |

- 着手の前に盤面を `show --archived` で読み、同じタスクのカード (チケットの URL のリンク、似た題) があればそれを使う。収集役が先に積んでいることがある。アーカイブしたカードなら `move` で `doing` へ戻す
- カードの `key` は、チケットがあればその URL、無ければ `session:<handoff の identifier>`。使うカード id は handoff ファイルに書き、以降の更新で同じカードを使う
- 質問への回答や短い調査など、作業を伴わないセッションでは更新しない

## アーカイブ

Done 列のカードをまとめて、ページが隠す `archived` 列へ移す。ページの Done 列の見出しにある `アーカイブ` ボタンと、次の手順は同じ `MOVE_CARD` を書く。ボタンは確認を挟まずに移す。

1. 「読む」で `actions` を読む
2. `node ~/.agents/playbooks/personal-task-board/scripts/board.ts archive <dir> <out-dir> [<盤面>]` を実行する。標準出力は `plan` と同じ `writes` の配列で、1 つずつ `batch` に渡す。標準エラーに移すカードが `archive: TASK-<n> <カード id> <題>` で出る
3. もう一度読み、Done が空になったことを確かめる

action を消さないので、カードの番号・コメント・リンクはそのまま残る。`move` で `archived` へは動かせない。

アーカイブしたカードを盤面に戻すのは `move` で行う (`show <dir> --archived` でカード id を調べ、元の列を `column` に渡す)。ページの Undo で戻せるのは、アーカイブしたページを開いたままの間だけである。アーカイブしたカードと同じ `key` の `add` は積まず、`skip:` に `archived` と出る。続きの作業があるなら `move` で戻す。

## 本人がページで書いたもの

ページでのカードの追加・移動・編集・コメントは db の `actions` に入るので、上の「読む」で読める。

- カードのコメントは、カード詳細の「コメント」欄から本人が書くものと、Agent が `comment` で書くものが同じ `comment` action として並ぶ。`show` で書き手が `Claude Code` のコメントは Agent が残した状況の記録で、依頼ではない。それ以外の書き手のコメントは本人から Agent への依頼やメモとして扱う
- Agent はコメントを消さない。古くなった状況は新しいコメントで上書きする
- Artifact のコメント (kit の review rail の Send to Claude で、ページを publish したセッションへ届くもの) はカードのコメントとは別物で、`actions` には入らない

ページが db から消すのは、そのページを開いてから本人が足した action (Undo の対象) とコメントだけである。操作ログの「すべてクリア」と、それ以前の action の削除は db に反映せず、盤面は db の内容に戻る。

## 同時更新

- 別々のカードへの同時の更新は、どちらも残る
- 同じカードの description を 2 者が同時に書き換えると、後に書いた方が残る (`move`・`detail`・`session` は読んだ時点の description を元に全体を書き換える)。本人がページで description を編集している間に Agent が同じカードに書いた内容も、本人の確定で消える
- 書いた後に読み直し、自分の変更が消えていたら同じ intent を書き直す
- カードの追加は、ページと Agent が同時に行っても失われない。番号は db の順で再生した時に決まる
- `board.ts archive` は読んだ時点で Done にあったカードを移す。読んでから `batch` するまでに本人が Done から出したカードも `archived` へ移るので、本人がページを操作している最中は使わない

## 盤面を更新できないとき

`ArtifactData` が無い、または書き込みに失敗したときは、本人に 1 回だけ伝えて本筋の作業を続ける。
