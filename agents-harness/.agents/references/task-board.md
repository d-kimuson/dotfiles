# パーソナルダッシュボード

本人のタスクを 1 つに集めるパーソナルダッシュボードの読み書きの手順。盤面は folio の HTML 文書 `/projects/パーソナルダッシュボード/personal-dashboard.html` で、読み書きに folio の MCP ツール (`folio_read_document`・`folio_edit_document`・`folio_update_document`・`folio_get_draft_state`) を使う。folio の MCP ツールを持つセッション (Claude Code など) なら、ローカルでも Claude Code on the web でも同じ手順で扱える。

## 置き場所

- `~/.agents/state/personal-dashboard/index.md`: マシンごとの入口。Git 管理外。形式は下の「index.md」
- folio の文書: dev-process-kit 0.4.2 の Kanban。カードを持たない空のテンプレートは `~/.agents/playbooks/personal-task-board/assets/board.html`。ページは 2 つある
  - `タスク` (盤面 `personal-task-board`): 列は `todo` (Todo)、`today` (今日やる)、`doing` (進行中)、`blocked` (Pending)、`done` (Done)。進行中の列は担い手で分かれ、本人が進めるカードが上、`Agent` の区切り線の下に Agent が進めるカードが並ぶ
  - `学習バックログ` (盤面 `personal-learning`): 列は `backlog` (バックログ)、`done` (Done)。retro が積む
  - どちらの盤面にも、ページが CSS で隠す最後の列 `archived` (アーカイブ) がある。下の「アーカイブ」で Done のカードを移す先である
- 盤面の正: folio の文書の HTML の各 `<dpk-board-kanban>` が持つ base JSON。変更履歴と処理済みの操作範囲 (`addressed`) は同じ HTML の `data-dpk-changes` に入る

本人のページ上での操作は、folio のサーバーに文書ごとの draft として溜まる (`folio_get_draft_state` で読める)。Agent が盤面を更新するときは、最新の HTML を読み、`board.ts` で base JSON を書き換えて同じ文書に書き戻す。

## index.md

```markdown
# パーソナルダッシュボード

- path: /projects/パーソナルダッシュボード/personal-dashboard.html
- url: https://folio.hs.kimuson.dev/d/projects/<path を URL エンコードしたもの>
- tools: folio_read_document, folio_edit_document, folio_update_document, folio_get_draft_state
```

`path` の行で読み書きし、`url` の行を本人に渡す。ほかの行は本人のメモとして残す。

## index.md が無いとき

Claude Code on the web では毎回次の手順で文書を得る。

1. `folio_read_document` で `/projects/パーソナルダッシュボード/personal-dashboard.html` を読む。読めたら、その `path` と `webUrl` で `index.md` を書く
2. 文書が無ければ、`~/.agents/playbooks/personal-task-board/assets/board.html` の中身を同じ path に `folio_create_document` で作り、返った `webUrl` で `index.md` を書く

## 読む

1. `folio_read_document` で文書を読み、結果の JSON (`content` と `revision` を持つ) か `content` の HTML を一時ファイルに保存する。`revision` は書くときの `baseRevision` に使う
2. `node ~/.agents/playbooks/personal-task-board/scripts/board.ts show <保存した HTML>` で盤面ごと・列ごとのカードを出す (`--json` を付けると JSON で出す)。1 行目は判定に使う今日の日付 (Asia/Tokyo)。カードの行は `- TASK-<n> <カード id> <題> [タグ] (属性) <リンク>` で、`(属性)` は `確認が必要`、`担い手 Agent` (担い手が Agent のときだけ)、`着手可能 <日付>`、`期日 <日付>` (Done とアーカイブ以外で過ぎていれば `超過`、今日なら `今日`) の並び。続く字下げ行が本文、`## Pending の理由`、状況の記録 (`> <日時> <書き手>: <本文>` の行、古い順)、`## セッション`、タグの警告 (`! <内容>`)
3. `show` はアーカイブの列を枚数だけ出す。アーカイブしたカードの中身は `show <保存した HTML> --archived` で出す

## 書く

1. 上の「読む」で最新の HTML を一時ファイルに保存し、`board.ts show` で盤面を確かめる
2. 変更を intents の JSON 配列でファイル (`intents.json`) に書く
3. `node ~/.agents/playbooks/personal-task-board/scripts/board.ts apply <保存した HTML> <intents.json> <out.html>` を実行する。標準出力は `{changes, skipped, addressed}` の JSON で、標準エラーに飛ばした intent の `skip: <理由>` が出る。`changes` が 0 なら書き戻さない
4. `node ~/.agents/playbooks/personal-task-board/scripts/board.ts edits <保存した HTML> <out.html>` で差分を置き換えの JSON 配列にし、`folio_edit_document` に `path`、`edits` (その配列そのまま)、`baseRevision` (手順 1 で読んだ `revision`) を渡して書き戻す。配列が空 (`[]`) なら差分が無いので書き戻さない。文書全体 (約 40,000 字) を送らずに済む。`edits` が作れないときや文書を作り直すときは、`folio_update_document` に `content` (`<out.html>` の中身そのまま) と `baseRevision` を渡す
5. 書き戻しが revision の衝突 (`{"error":"CONFLICT","reason":"stale","currentRevision":n}`) で拒まれたら、手順 1 で読み直して保存し直し、同じ `intents.json` で手順 3 から当て直す。やり直しは 3 回までとする
6. 書いた結果の `size` (文字数) が `<out.html>` の文字数と同じことを確かめ、`folio_read_document` で読み戻して `board.ts show` で変更が盤面に出たことを確かめる

| intent | すること |
| --- | --- |
| `{"op":"add","key":k,"board"?:b,"column":c,"title":t,"detail"?:d,"reason"?:r,"tags"?:[..],"links"?:[{"url","label"?}],"sessions"?:[s],"start"?:日付,"due"?:日付,"owner"?:"self"\|"agent"}` | カードを積む。カード id は `key` から決まり、どの盤面かに同じ `key` のカードがあれば積まない。`board` の既定は `personal-task-board`。`start`・`due`・`owner` は着手可能日・期日・担い手 |
| `{"op":"move","key"?:k,"card"?:id,"column":c,"reason"?:r}` | 列を移す。`blocked` へは `reason` (何を待っているか) が要り、description の `## Pending の理由` になる。`blocked` から出すと `## Pending の理由` を消す |
| `{"op":"detail","key"?:k,"card"?:id,"text":t}` | description の本文に段落を足す |
| `{"op":"link","key"?:k,"card"?:id,"url":u,"label"?:l}` | リンクを足す。成果物 (PR やコミット) もここに置く |
| `{"op":"session","key"?:k,"card"?:id,"session":s}` | セッションの参照を足す。形式は下の「セッションの参照」 |
| `{"op":"comment","key"?:k,"card"?:id,"text":t,"at":日時,"by"?:書き手}` | description の `## 記録` 節に 1 行足す。状況・方針・進み具合はここに書く。`at` は Asia/Tokyo の `YYYY-MM-DD HH:mm` (必須)。`by` を省くと `Claude Code` になる |
| `{"op":"check","key"?:k,"card"?:id,"on":true,"text"?:t,"at"?:日時,"by"?:書き手}` | `確認が必要` タグを付ける。`text` を渡すと `## 記録` に `確認が必要: <text>` を足す (`text` に本人に確かめてほしいことを書き、`at` も固定して再適用での重複を防ぐ)。`text` を渡すときは `at` が必須で、`text` が無ければ `at` は要らない |
| `{"op":"check","key"?:k,"card"?:id,"on":false}` | `確認が必要` タグを外す |
| `{"op":"start"\|"due","key"?:k,"card"?:id,"date":日付\|null}` | `着手可能 <日付>` か `期日 <日付>` のタグを設定する。`null` で外す |
| `{"op":"owner","key"?:k,"card"?:id,"who":"self"\|"agent"\|null}` | 担い手を設定する。`"agent"` は `assignee` に `Agent` を入れ、`"self"` と `null` は `Agent` を外す。本人が詳細で入れた `Agent` 以外の `assignee` は残る |
| `{"op":"archive","board"?:b}` | Done 列のうち `確認が必要` タグが無いカードを `archived` 列へ移す。`board` を省くと全盤面 |

- `key`: チケットがあればその URL。無ければ出どころが分かる一意な文字列 (`slack:<channel>/<スレッドの親の ts>`、`session:<handoff の identifier>` など)。URL の `key` は host の大小・fragment・末尾の `/` をそろえてからカード id にする (`board.ts id <key>` で確かめられる)。本人がページで足したカードは `card` に `board.ts show` のカード id を渡す
- 列は上の「置き場所」のとおり。`today` は本人が選ぶ列で、Agent はカードを `today` へ動かさない。`today` にあるカードの着手は `doing` へ動かす
- `links` は URL として読める `http(s)` の URL だけ。ローカルのパスは `detail` に書く
- タグは種類 (`判断`・`学習`・`作業` から 1 つ) と、プロジェクトに属すならプロジェクト名 (remote のリポジトリ名、無ければディレクトリ名)。下の「カードの属性」の予約タグ (`確認が必要`、`着手可能 YYYY-MM-DD`、`期日 YYYY-MM-DD`) とは別に付ける
- description は本文、`## Pending の理由`、`## 記録`、`## セッション` の順に並ぶ。経緯と状況は `comment` で `## 記録` に書く。いまの状態は列が表す
- 日付は Asia/Tokyo の暦日を `YYYY-MM-DD` で、`at` は Asia/Tokyo の日時を `YYYY-MM-DD HH:mm` で書く (`TZ=Asia/Tokyo date "+%Y-%m-%d %H:%M"`)

## カードの属性

確認が必要・着手可能日・期日は予約タグ、担い手は `assignee` で表す。

| 属性 | base での表し方 | 意味 | ページでの出方 |
| --- | --- | --- | --- |
| 確認が必要 | タグ `確認が必要` | 本人の確認を待っている。列とは別で、カードは動かない | カードの題の上に塗りつぶしのバッジで出て、枠と背景が amber になる。汎用のタグとしては出ない。本人は詳細の「確認が必要にする」/「確認済みにする」ボタンで付け外しする |
| 着手可能日 | タグ `着手可能 YYYY-MM-DD` | この日から着手できる | カード表面に `着手可能 12/3` の印が出る。今日 (Asia/Tokyo) がこの日より前なら、`todo` と `backlog` のカードは既定で隠れる。当日からは出る。ほかの列のカードは隠さない。ヘッダーの「着手前 N 枚を表示」で隠れたカードも淡く出せる。本人は詳細の着手可能日の欄 (date 入力と解除) で変える |
| 期日 | タグ `期日 YYYY-MM-DD` | この日までに済ませる | カード表面に `期日 12/5` の印が出る。Done とアーカイブ以外のカードは、期日を過ぎると `超過`、当日は `今日` が付き、印と左の帯が色付く。本人は詳細の期日の欄 (date 入力と解除) で変える |
| 担い手 | `assignee` が `Agent` (未設定は本人) | 本人が手で進めるか、Agent に進めさせるか。列とは別で、カードは動かない | カード表面に `Agent` が出る。進行中 (`doing`) の列では、本人のカードが区切り線の上、`Agent` のカードが下に並ぶ。本人は詳細の担い手の select (自分 / Agent) で切り替える |

本人が詳細の属性の欄で変えた内容は、タグと assignee の draft action (`ADD_CARD_TAG`・`REMOVE_CARD_TAG`・`SET_CARD_ASSIGNEE`) としてレビューに出る。レビューの Agent は、他の操作と一緒に `board.ts review` でそのまま反映する。

- 「確認が必要」は、本人の確認か判断が要る状態でセッションを終えるとき (成果物を見てほしい、方針を選んでほしい) に立てる。作業が済んでいれば、先に `move` で `done` へ移す。セッションの中で本人に尋ねるだけなら立てない
- セッションの中で本人の確認を受けたら、`check` を `on: false` で下ろす
- Pending は本人以外の事情 (レビュー、外部の返事など) で進められないときに使う。本人の確認待ちは Pending でなく `確認が必要` で表す
- 着手可能日と期日は、チケットか本人の指示に日付があるときだけ書く。推測で書かない
- Claude Code のセッションが自分の作業のカードを積む・着手するときは、担い手を `agent` にする。本人がページで足したカードは `assignee` を持たず、本人のものとして並ぶ。本人が作業を引き取ったと言ったら `self` にする

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

URL はリンク (`add` 時は label `session`) に、ローカルの参照は description の `## セッション` に 1 行ずつ入る。同じ参照は 2 度付かない。セッションログから参照を作るときは、ログのファイル名の末尾の UUID が session id である (`retro/scripts/sessions.ts` は `session: <provider> <id>` の行で出す)。

## Claude Code セッションの更新

着手中のタスクのカードを、次の要所で更新する。

| 要所 | intent |
| --- | --- |
| 着手 | カードが無ければ `add` (`column: "doing"`, `sessions: [自分の参照]`, `owner: "agent"`)。あれば `move` で `doing` へ動かし、`session` で自分の参照を足し、`owner` で `agent` にする |
| 方針の確定 | `comment` に決めた方針を 1〜3 行 |
| 状況の変化 (区切りの作業が済んだ、委譲した、レビューを待つなど) | `comment` に 1〜3 行 |
| 待ちに入った (レビュー、外部の返事など、本人以外の事情) | `move` で `blocked` (Pending) へ。`reason` に何を待っているか |
| 待ちが解けた | `move` で `doing` へ |
| 本人の確認か判断が要る状態でセッションを終える | `check` を `on: true` で立てる。`text` に何を確かめてほしいか、`at` に現在時刻を入れる (`text` を渡すときは `at` が必須) |
| セッションの中で本人の確認を受けた | `check` を `on: false` で下ろす |
| 完了 | `move` で `done` へ。成果物 (PR やコミット) を `link` で足す |

- 着手の前に盤面を `show --archived` で読み、同じタスクのカード (チケットの URL のリンク、似た題) があれば該当するカードを使う。収集役が先に積んでいることがある。アーカイブしたカードなら `move` で `doing` へ戻す
- カードの `key` は、チケットがあればその URL、無ければ `session:<handoff の identifier>`。使うカード id は handoff ファイルに書き、以降の更新で同じカードを使う
- 質問への回答や短い調査など、作業を伴わないセッションでは更新しない

## アーカイブ

Done 列のカードをまとめて、ページが隠す `archived` 列へ移す。

- ページの Done 列見出しの `アーカイブ` ボタンは、draft を反映した盤面で Done にあり、`確認が必要` タグを持たないカードに対し、確認を挟まずに `archived` 列への `MOVE_CARD` を draft に積む (レビューの反映で base に確定する)
- Agent がアーカイブするときは、「書く」の手順で `{"op":"archive"}` (盤面を絞るなら `"board": "<盤面>"`) を `intents.json` にして `apply` から書き戻しまでを行う
- `確認が必要` タグを持つカードは、ボタンでも `archive` intent でも Done に残す。本人の確認の前にカードが隠れないためである
- カードを削除せず `archived` 列へ移すだけなので、カード番号・記録・リンクはそのまま残る。`move` intent で `archived` へは動かせない
- アーカイブしたカードを盤面に戻すときは、`show --archived` でカード id を調べ、`move` で元の列へ移す。アーカイブしたカードと同じ `key` の `add` は積まず、`skip:` になる

## 本人がページで書いたもの

ページでのカードの追加・移動・編集・タグの変更・詳細の属性の欄 (確認が必要・着手可能日・期日・担い手) の変更・「記録を足す」からの追記・アーカイブボタン・レビューコメントは、すべて dev-process-kit の draft action になる。folio はこの draft を文書ごとにサーバーへ同期し (5 秒ごと)、同じ文書を開いた全員に同じ draft が見える。

- draft は Agent が `board.ts review` で base に反映し、`addressed` を書き戻すまで base には入らない
- Agent が書き戻した更新は、本人がページを開き直すまでページに見えない
- 書き戻した `addressed` に入った action は、次に誰かがページを開いたとき kit が draft から消す。それまで `folio_get_draft_state` に残るが、`board.ts review` は `addressed` 済みの action を当て直さない (出力の `handled` に出る)
- 期日の強調、着手前の非表示、進行中列の担い手による区切り線は、draft を反映した `el.items()` から計算する

### コメントの 2 つの種類

| | 状況の記録 (`## 記録`) | レビューコメント |
| --- | --- | --- |
| 書く場所 | カード詳細の「記録を足す」欄、`board.ts` の `comment` intent | カードを右クリックした「レビューコメント」(kit の review rail) |
| 置き場所 | カードの description の `## 記録` 節 | folio の draft (kit の `comment` action) |
| 用途 | 本人と Agent が状況やメモを書き残す | 本人から Agent への指示 |
| 寿命 | 残す。古くなった状況は新しい行を足す | 応えて `addressed` を書き戻すと、次にページを開いたとき draft から消える |
| 読み方 | `board.ts show` でカードの下に `> <日時> <書き手>: <本文>` で出る | `board.ts review` の出力の `comments` に出る |

状況の記録のうち、書き手が `Claude Code` などの Agent の行は状況の記録で、依頼ではない。`本人` の行は本人のメモや依頼として読む。

### レビューコメントに応える

本人から盤面の draft の反映を頼まれたら (「盤面を見て」「レビューした」など)、次の手順で反映して応える。本人が kit の「変更・コメントをコピー」で brief (Markdown) を貼り付けたときも、手順 1 の代わりに brief を `<draft.json>` の代わりのファイルに保存して同じ手順で進める。

1. `folio_get_draft_state` で文書の draft を読み、結果の JSON を一時ファイル `<draft.json>` に保存する。`board.ts review` は storageKey が `personal-task-board` の group の action だけを使う
2. `folio_read_document` で最新の文書を読み、保存する (「読む」の手順 1)
3. `node ~/.agents/playbooks/personal-task-board/scripts/board.ts review <保存した HTML> <draft.json> <out.html> [--keep <id>...]` を実行する。標準出力の `results` (`applied`・`stale`・`comment`)、`addressed`、`handled` (反映済みで当て直さなかった action)、`comments` を確認する
   - 本人に確かめたい action があれば、該当する action の id を `--keep` に渡して `review` をやり直す。見送った action は `addressed` から外れ、draft に残る
   - brief を渡したときは、見送りが無く、計算した `addressed` が brief の `## Change log: addressed` と一致しなければ `board.ts review` はエラーで止まる
4. `comments` (レビューコメント) は本人から Agent への指示として扱い、盤面の変更が必要なら `intents.json` を作って `node ~/.agents/playbooks/personal-task-board/scripts/board.ts apply <out.html> <intents.json> <out2.html>` で反映する。レビューコメントの本文は `## 記録` には写さない
5. 「書く」の手順 4 と同じく、`board.ts edits` で作った置き換えを `folio_edit_document` に、手順 2 の `revision` を `baseRevision` として渡して書き戻す。配列が空なら書き戻さない。衝突で拒まれたら、手順 1 から読み直して当て直す。やり直しは 3 回までとする
6. `folio_read_document` で読み戻し、`board.ts show` で反映を確かめる
7. 本人へ結果をセッションで伝える (反映した内容、レビューコメントへの返事、`stale` になった操作と見送った操作)
8. 書き戻した `addressed` により、次にページを開いたとき処理済みの操作が draft から消え、バッジが 0 になる (見送った操作だけは残る)

## 同時更新

- Agent 同士の更新: `folio_edit_document` と `folio_update_document` は `baseRevision` が最新の revision でなければ衝突で拒む。衝突したら最新の文書を読み直し、同じ `intents.json` を `apply` し直して書き戻す (3 回まで)。各 intent は再適用しても同じ結果になるため (`comment` は同じ日時・書き手・本文の行を重ねない、`add` は同じ `key` を積まない)、別セッションの更新も自分の更新も失われない
- 本人の draft と Agent の更新: 本人の操作は `board.ts review` で最新の base に再生される。folio の draft は閲覧者の間で共有されるので、本人が複数の端末で操作しても 1 つの draft にまとまる。同じカードに Agent が足した `## 記録` がある状態で本人の `SET_CARD_DESCRIPTION` を再生しても、`board.ts review` は `## 記録` 節を両方の行の和集合 (日時順) にするため、Agent の記録は消えない。`## 記録` 以外の節や題・列・Assignee を本人と Agent が同時に変えた場合は、レビュー再生時に本人の値が採られる。重複する追加や消えたカードへの操作は `stale` になり base には書かれない。判断が要る操作は `--keep` で見送って本人に確かめる

## 盤面を更新できないとき

folio の MCP ツールが無い、または書き戻しに失敗した (衝突のやり直し 3 回を超えた場合を含む) ときは、本人に 1 回だけ伝えて本筋の作業を続ける。
