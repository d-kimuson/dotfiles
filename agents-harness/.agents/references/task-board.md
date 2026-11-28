# Task Board

本人のタスクを 1 つに集める Personal Task Board の読み書きの仕方。盤面は「パーソナルダッシュボード」という題の Claude Artifact のページで、読み書きに `Artifact` と `ArtifactData` ツールを使う。ローカルの Claude Code と Claude Code on the web のどちらでも同じ手順で扱える。

## 置き場所

- `~/.agents/state/task-board/index.md`: マシンごとの入口。Git 管理外。形式は下の「index.md」
- Artifact: dev-process-kit の Kanban。ページの HTML は `~/.agents/playbooks/personal-task-board/assets/board.html` で、カードを持たない。ページは 2 つある
  - `タスク` (盤面 `personal-task-board`): 列は `todo` (Todo)、`today` (今日やる)、`doing` (進行中)、`blocked` (Pending)、`done` (Done)。進行中の列は担い手で分かれ、本人が進めるカードが上、`Agent` の区切り線の下に Agent が進めるカードが並ぶ
  - `学習バックログ` (盤面 `personal-learning`): 列は `backlog` (バックログ)、`done` (Done)。retro が積む
  - どちらの盤面にも、ページが隠す最後の列 `archived` (アーカイブ) がある。下の「アーカイブ」で Done のカードを移す先である
- カードの正: Artifact の db の `actions` コレクション。1 文書が dev-process-kit の draft action 1 つ (`ADD_CARD`、`MOVE_CARD`、`SET_CARD_DESCRIPTION`、`comment` など)。ページはこれを順に再生して盤面を描き、本人がページで編集した分も同じコレクションに入る
- カードのコメントの正: db の `notes` コレクション。1 文書が 1 つのコメント (`{id, board, card, body, author, createdAt}`)。kit の draft の外に置くので、kit のレビューコメントには出ない。下の「コメントの 2 つの種類」を参照
- カードの属性の正: db の `attrs` コレクション。カードと属性の組ごとに 1 文書 (doc id `<盤面>~<カード id>~<属性>`)。属性が無いときは文書も無い。下の「カードの属性」を参照

Agent は `actions` と `notes` に文書を追記するだけで、既存の文書を書き換えない。`attrs` の文書は作る・置き換える・消すが、既にある文書は version を確かめてから書く。`actions` から消すのは、対応したレビューコメントの action と、`migrate-notes` で `notes` へ移した action だけである。別々のセッションが同時に別のカードを更新しても、互いの更新は消えない。

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

1. 空のディレクトリ `<dir>` を作り (`mktemp -d`)、`ArtifactData` の `list` を `url` に盤面の URL、`collection: "actions"`、`query: {"limit": 1000}`、`out_dir: <dir>` で呼ぶ。`next_cursor` が返る間は `query.cursor` に渡して同じ `out_dir` へ続けて読む。`collection: "notes"` と `collection: "attrs"` も同じ `out_dir` へ同じように読む
2. `node ~/.agents/playbooks/personal-task-board/scripts/board.ts show <dir>` で盤面ごと・列ごとのカードを出す。1 行目は判定に使う今日の日付 (Asia/Tokyo)。カードの行は `TASK-<n> <カード id> <題> [タグ] (属性) <リンク>` で、属性は `確認が必要`、`担い手 自分` か `担い手 Agent`、`着手可能 <日付>` (今日より後のときだけ)、`期日 <日付>` (過ぎていれば `超過`、今日なら `今日`) の並び。続く字下げ行が description と、カードのコメント (`> <日時> <書き手>: <本文>` の行、古い順。書き手は `Claude Code` などの Agent か `本人`)。カードが消えたコメントは「カードの無いコメント」の節に、レビューコメントは「レビューコメント (本人から Agent への指示)」の節に出る
3. `show` はアーカイブの列を枚数だけ出す。アーカイブしたカードの中身は `show <dir> --archived` で出す

`<dir>/actions` が無いと `board.ts` は失敗する。`<dir>/notes` と `<dir>/attrs` が無ければ、コメントと属性の無い盤面として読む。`list` が 0 件で盤面が空のときだけ、`show` と `plan` に `--empty` を付ける。

毎回新しい `<dir>` に読む。前回の読み込みが残ると、消えた action を読んでしまう。

## 書く

1. 上の「読む」で盤面を読む
2. 変更を intents の JSON 配列でファイルに書く
3. `node ~/.agents/playbooks/personal-task-board/scripts/board.ts plan <dir> <intents.json> <out-dir>` を実行する。標準出力は `ArtifactData` の `batch` 1 回分ずつの `writes` の配列 (`actions`・`notes`・`attrs` への書き込み) なので、1 つずつ `batch` に渡す。`skip:` の行は書かなかった intent とその理由
   - `plan` が `attrs/<doc id> がある` で止まったら、`ArtifactData` の `get` (`collection: "attrs"`, `doc_id`) で version と値を読む。値が読んだ盤面と同じなら、その intent に `if_version` を付けて `plan` し直す。違えば本人が間に変えているので、読み直して intent を決め直す
   - `batch` が version の不一致で拒まれたら、その `batch` は何も書いていない。読み直して `plan` からやり直す。それより前の `batch` が通っていれば、`add` は既にあるとして飛ばされるので、そのカードの属性は `start`・`due`・`owner` の intent で書き直す
4. もう一度読んで、変更が盤面に出たことを確かめる

| intent | すること |
| --- | --- |
| `{"op":"add","key":k,"board"?:b,"column":c,"title":t,"detail"?:d,"reason"?:r,"tags"?:[..],"links"?:[{"url","label"?}],"sessions"?:[s],"start"?:日付,"due"?:日付,"owner"?:"self"\|"agent"}` | カードを積む。カード id は `key` から決まり、同じ `key` のカードがあれば積まない。`board` の既定は `personal-task-board`。`start`・`due`・`owner` は着手可能日・期日・担い手 |
| `{"op":"move","key"?:k,"card"?:id,"column":c,"reason"?:r}` | 列を移す。`blocked` へは `reason` (何を待っているか) が要り、description の `## Pending の理由` になる。`blocked` から出すと `## Pending の理由` を消す |
| `{"op":"detail","key"?:k,"card"?:id,"text":t}` | description の説明に段落を足す |
| `{"op":"link","key"?:k,"card"?:id,"url":u,"label"?:l}` | リンクを足す。成果物 (PR やコミット) もここに置く |
| `{"op":"session","key"?:k,"card"?:id,"session":s}` | セッションの参照を足す。形式は下の「セッションの参照」 |
| `{"op":"comment","key"?:k,"card"?:id,"text":t}` | カードのコメントを `notes` に足す。状況・方針・進み具合はここに書く。書き手は `Claude Code` と出る |
| `{"op":"check","key"?:k,"card"?:id,"on":true,"text":t}` | 「確認が必要」を立て、`確認が必要: <text>` のコメントを足す。`text` には本人に何を確かめてほしいかを書く |
| `{"op":"check","key"?:k,"card"?:id,"on":false,"if_version":n}` | 「確認が必要」を下ろす |
| `{"op":"start"\|"due","key"?:k,"card"?:id,"date":日付\|null,"if_version"?:n}` | 着手可能日 (`start`) か期日 (`due`) を設定する。`null` で外す |
| `{"op":"owner","key"?:k,"card"?:id,"who":"self"\|"agent"\|null,"if_version"?:n}` | 担い手を設定する。`null` で外す (外したカードは本人が進めるものとして並ぶ) |
| `{"op":"archive","board"?:b}` | Done のカードを `archived` へ移す。下の「アーカイブ」と同じ。`board` を省くと全盤面 |

- `key`: チケットがあればその URL。無ければ出どころが分かる一意な文字列 (`slack:<channel>/<スレッドの親の ts>`、`session:<handoff の identifier>` など)。URL の key は host の大小・fragment・末尾の `/` をそろえてからカード id にする。本人がページで足したカードは `card` に `board.ts show` のカード id を渡す
- 列は上の「置き場所」のとおり。`today` は本人が選ぶ列で、Agent はカードを `today` へ動かさない。`today` にあるカードの着手は `doing` へ動かす
- `links` は `http(s)` の URL だけ。ローカルのパスは `detail` に書く
- タグは種類 (`判断`・`学習`・`作業` から 1 つ) と、プロジェクトに属すならプロジェクト名 (remote のリポジトリ名、無ければディレクトリ名)
- description は説明、`## Pending の理由`、`## セッション` の 3 節だけにする。経緯と状況は `comment` に書く。いまの状態は列が表す
- 日付は Asia/Tokyo の暦日を `YYYY-MM-DD` で書く
- 既にある属性を変える・外す intent には `if_version` が要る (上の手順 3)

## カードの属性

| 属性 | 意味 | ページでの出方 |
| --- | --- | --- |
| 確認が必要 (`check`) | 本人の確認を待っている。列とは別で、カードは動かない | カードの上に印が出る。本人は詳細のチェックを外して下ろす |
| 着手可能日 (`start`) | この日から着手できる | 今日 (Asia/Tokyo) がこの日より前なら、`todo` と `backlog` のカードは既定で隠れる。当日からは出る。ほかの列のカードは隠さず、日付の印だけを出す。ヘッダーの「着手前 N 枚を表示」で隠れたカードも淡く出せる |
| 担い手 (`owner`) | `self` は本人が手で進めている、`agent` は Agent に進めさせている。列とは別で、カードは動かない | 進行中の列で、`self` と未設定のカードは区切り線の上、`agent` のカードは下に並ぶ (Kanban と List)。本人は詳細の「担い手」で切り替える |
| 期日 (`due`) | この日までに済ませる | カードに日付が出る。Done とアーカイブ以外のカードは、期日を過ぎると `超過`、当日は `今日` の色で出る |

- 「確認が必要」は、本人の確認か判断が要る状態でセッションを終えるとき (成果物を見てほしい、方針を選んでほしい) に立てる。作業が済んでいれば、先に `move` で `done` へ移す。セッションの中で本人に尋ねるだけなら立てない。本人がその場にいるからである
- セッションの中で本人の確認を受けたら、`check` を下ろす
- Pending は本人以外の事情 (レビュー、外部の返事など) で進められないときに使う。本人の確認待ちは Pending でなく「確認が必要」で表す
- 着手可能日と期日は、チケットか本人の指示に日付があるときだけ書く。推測で書かない
- Claude Code のセッションが自分の作業のカードを積む・着手するときは、担い手を `agent` にする。本人がページで足したカードは担い手を持たず、本人のものとして並ぶ。本人が作業を引き取ったと言ったら `self` にする

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
| 着手 | カードが無ければ `add` (`column: "doing"`, `sessions: [自分の参照]`, `owner: "agent"`)。あれば `move` で `doing` へ動かし、`session` で自分の参照を足し、`owner` で `agent` にする |
| 方針の確定 | `comment` に決めた方針を 1〜3 行 |
| 状況の変化 (区切りの作業が済んだ、委譲した、レビューを待つなど) | `comment` に 1〜3 行 |
| 待ちに入った (レビュー、外部の返事など、本人以外の事情) | `move` で `blocked` (Pending) へ。`reason` に何を待っているか |
| 待ちが解けた | `move` で `doing` へ |
| 本人の確認か判断が要る状態でセッションを終える | `check` を `on: true` で立てる。`text` に何を確かめてほしいか |
| セッションの中で本人の確認を受けた | `check` を `on: false` で下ろす |
| 完了 | `move` で `done` へ。成果物 (PR やコミット) を `link` で足す |

- 着手の前に盤面を `show --archived` で読み、同じタスクのカード (チケットの URL のリンク、似た題) があればそれを使う。収集役が先に積んでいることがある。アーカイブしたカードなら `move` で `doing` へ戻す
- カードの `key` は、チケットがあればその URL、無ければ `session:<handoff の identifier>`。使うカード id は handoff ファイルに書き、以降の更新で同じカードを使う
- 質問への回答や短い調査など、作業を伴わないセッションでは更新しない

## アーカイブ

Done 列のカードをまとめて、ページが隠す `archived` 列へ移す。ページの Done 列の見出しにある `アーカイブ` ボタンと、次の手順は同じ `MOVE_CARD` を書く。ボタンは確認を挟まずに移す。

1. 「読む」で `actions` を読む
2. `node ~/.agents/playbooks/personal-task-board/scripts/board.ts archive <dir> <out-dir> [<盤面>]` を実行する。標準出力は `plan` と同じ `writes` の配列で、1 つずつ `batch` に渡す。標準エラーに移すカードが `archive: TASK-<n> <カード id> <題>` で出る
3. もう一度読み、Done に残ったのが「確認が必要」のカードだけであることを確かめる

「確認が必要」のカードは、ボタンでも `board.ts archive` でも Done に残す。本人の確認の前にカードが隠れないためである。

action を消さないので、カードの番号・コメント・リンクはそのまま残る。`move` で `archived` へは動かせない。

アーカイブしたカードを盤面に戻すのは `move` で行う (`show <dir> --archived` でカード id を調べ、元の列を `column` に渡す)。ページの Undo で戻せるのは、アーカイブしたページを開いたままの間だけである。アーカイブしたカードと同じ `key` の `add` は積まず、`skip:` に `archived` と出る。続きの作業があるなら `move` で戻す。

## 本人がページで書いたもの

ページでのカードの追加・移動・編集は db の `actions` に、カードのコメントは `notes` に、カード詳細で設定した属性は `attrs` に入るので、上の「読む」で読める。kit の Undo は属性の変更を戻さない。属性は詳細の欄で直す。

ページが db から消すのは、そのページを開いてから本人が足した action (Undo の対象) とレビューコメントだけである。操作ログの「すべてクリア」と、それ以前の action の削除は db に反映せず、盤面は db の内容に戻る。`notes` はページから消せない。

### コメントの 2 つの種類

| | カードのコメント | レビューコメント |
| --- | --- | --- |
| 書く場所 | カード詳細の「コメント」欄、`board.ts` の `comment` intent | カードを右クリックした「レビューコメント」(kit の review rail) |
| 置き場所 | db の `notes` | db の `actions` の `comment` action (kit の draft) |
| 用途 | 本人と Agent が状況やメモを書き残す | 本人から Agent への指示 |
| 寿命 | 残す。古くなった状況は新しいコメントで上書きする | 対応したら消す |
| `show` での出方 | カードの下の `>` の行 | 「レビューコメント (本人から Agent への指示)」の節。行頭が action の id |

- カードのコメントのうち、書き手が `Claude Code` などの Agent のものは状況の記録で、依頼ではない。`本人` のものは本人のメモや依頼として読む
- 「Agent が actions に書いたコメント」の節が出たら、前の形式で書かれたカードのコメントである。`board.ts migrate-notes <dir> <out-dir>` の writes を 1 つずつ `batch` に渡して `notes` へ移す。同じ id の note を書いてから action を消すので、途中で止まっても再実行でよい

### レビューコメントに応える

本人がページで Send to Claude を押すと、kit の brief が Artifact のコメントとして、ページを publish したセッションへ届く。

1. コメントが `reviews/<id>` を指すとき (brief が 4096 バイトを超えたとき) は、`ArtifactData` の `get` (`collection: "reviews"`, `doc_id: <id>`) で brief を読む
2. brief の `## Comments` にある指示だけに応える。brief の Requested changes はページでの盤面の操作で、既に db に入っている。brief が求める base への書き込み、再 publish、`addressed` の書き込みはしない。盤面の正は db の `actions` で、base に書くと正が 2 つになる
3. 「読む」で盤面を読み、指示を「書く」の intents で反映する
4. 対応したレビューコメントの action を消す。`show` のレビューコメントの節で id を調べ、`ArtifactData` の `get` (`collection: "actions"`, `doc_id`) で version を読み、`batch` に `{"op":"delete","collection":"actions","doc_id":<id>,"if_version":<version>}` を渡す。kit の addressed と同じく、ページのレビューコメントのパネルから消える
5. `ArtifactComments` の `reply` (`thread_id` は通知のもの) で、反映したことと反映しなかったことを返し、`resolve` する。`reply` が guidance を返したら、セッションで答え、スレッドに届かなかったことを本人に伝える

## 同時更新

- 別々のカードへの同時の更新は、どちらも残る
- 属性はカードと属性の組ごとに別の文書なので、別の属性の同時の更新はどちらも残る。同じ属性をページで 2 者が同時に変えると、後に書いた方が残る。Agent は `get` で読んだ version を `if_version` に付けるので、`get` の後に本人が変えていれば `batch` が拒まれる。読んだ盤面と `get` の値が違うときに読み直せば (「書く」の手順 3)、本人の変更を黙って上書きしない
- 同じカードの description を 2 者が同時に書き換えると、後に書いた方が残る (`move`・`detail`・`session` は読んだ時点の description を元に全体を書き換える)。本人がページで description を編集している間に Agent が同じカードに書いた内容も、本人の確定で消える
- 書いた後に読み直し、自分の変更が消えていたら同じ intent を書き直す
- カードの追加は、ページと Agent が同時に行っても失われない。番号は db の順で再生した時に決まる
- `board.ts archive` は読んだ時点で Done にあったカードを移す。読んでから `batch` するまでに本人が Done から出したカードも `archived` へ移るので、本人がページを操作している最中は使わない

## 盤面を更新できないとき

`ArtifactData` が無い、または書き込みに失敗したときは、本人に 1 回だけ伝えて本筋の作業を続ける。
