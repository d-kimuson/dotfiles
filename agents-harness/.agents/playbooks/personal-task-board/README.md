# Personal Task Board

仕事モデル (https://claude.ai/artifact/SDRamdob1iKXw1bpp2jLmu) の Personal Task Board。Software Factory の外で、本人がやることを学習も含めて 1 か所に集める。`/task-board` prompt はこれへの alias。

- 積むのは、着手中のタスクを更新する Claude Code セッション (AGENTS.md のルール)、収集役 (`references/manage-user.md`)、`product-manage` (タスク管理元から拾ったタスク)、`retro` (学習バックログ)
- タスクはプロジェクト横断で 1 つの盤面に集め、プロジェクト名のタグで絞る。学習バックログは同じ Artifact の別ページの Kanban (`personal-learning`) にした。タスクの列に混ぜると、今日やることを選ぶときに学習のカードが邪魔になるため
- 列は Todo・今日やる・進行中・ブロック・Done。今日やるは本人が朝に選ぶ列で、Agent は動かさない
- カードの description は説明・ブロック理由・セッションの参照だけを持ち、経緯と状況はカードのコメントに書く。前の形式の `## 状況` と担当者はやめた。状態は列が表し、盤面の持ち主は本人 1 人であるため。ページは担当者と Status の欄を Shadow DOM への style で隠す
- セッションの参照は、web のセッションは claude.ai の URL をリンクに、ローカルのセッションは `<provider> <session id>` を description に置く。どのセッションで進めたかを後から辿るため
- ページの題は「パーソナルダッシュボード」。Personal Task Board は、その中の Kanban 2 枚と読み書きの仕組みの名前として残す
- ページが描くのは kit の Kanban だけにした。前の版の下の欄 (列ごとの枚数・ブロック中・最近動いたカード) は本人の要望で外し、アーカイブのボタンは Done 列の見出しへ移した。kit の Kanban の見出しの行 (盤面の名前) も CSS の `::part(header)` で隠す
- List と Kanban の切り替えは、ヘッダーの Segmented Control で 2 枚の Kanban の `data-view` を変え、adopted stylesheet で列を縦に積む。自前の一覧を描かないので、List でもドラッグ・詳細・コメントは Kanban と同じに動く。選択は localStorage の `ptb.view` に置き、storage が使えない環境では毎回 Kanban から始める
- カードと詳細は、題 → 説明 → 番号・タグ・リンクの順に CSS の `order` で並べ替える。kit の DOM の順は変えない
- カードのコメントは kit の `comment` action をそのまま使い、ページはカード詳細の末尾にコメント欄を差し込む。書き込みは Kanban 要素の `api.comment`、表示は db の action から出す。Agent も `board.ts` の `comment` で同じ action を書くので、状況の記録は本人と Agent で 1 か所にまとまる。差し込みは Done 見出しのボタンとコメント欄の 2 か所だけで、kit が描き直すたびに MutationObserver から入れ直す
- claude.ai の Artifact は sandbox の iframe で、`allow-modals` と `allow-forms` が無い前提で作る。`confirm()` は常に false になり、form の submit は発火しないので、どちらも使わない。kit の詳細にあるリンクの追加は form の submit で動くので、ページが Add の click と Enter を拾って同じ `ADD_CARD_LINK` を書く
- 盤面は Claude Artifact に置いた dev-process-kit の Kanban。ローカルの `board.json` と `file://` のページをやめたのは、複数のセッションと本人が同じ盤面を同時に読み書きするため
- カードの正は Artifact の db の `actions` コレクションで、1 文書が draft action 1 つ。ページは `sync.js` の `serveDraftSync` に db を Transport として渡し、本人の編集も同じコレクションへ追記する。既存の文書を書き換えないので、別々のカードへの同時の更新は消えない。同じカードの description を同時に書き換えたときだけ、後の書き込みが勝つ
- Agent 側は `ArtifactData` で `actions` を読み、`scripts/board.ts` で dev-process-kit の Kanban と同じ規則で畳み込む。カード id はチケットの URL などの key のハッシュにして、セッションと収集役が同じタスクに同じ id を使い、重複した `ADD_CARD` は stale になる
- ページが db から消すのは、開いてから本人が足した action とコメントだけにした。kit の「すべてクリア」や古い action の削除・Undo をそのまま db に通すと、Agent や収集役が積んだカードまで消えるため
- カード 1 枚を db の 1 文書にする案は採らなかった。ページ側で kit の action を合成する transport が要り、claude.ai 上で確かめられない kit 内部への依存が増えるため
- `ADD_CARD` に番号を書かず、kit が再生の時に振る番号に任せる。番号を明示すると、ページと Agent が同時に足したときに番号が重なり、後の `ADD_CARD` が stale になってカードが失われるため
- `assets/board.html` はカードを持たないので、全マシンで同じテンプレートから盤面を作れる。マシンごとの盤面の URL は `~/.agents/state/task-board/index.md` (Git 管理外) に置く
- アーカイブは、Done のカードをページが CSS で隠す最後の列 `archived` へ `MOVE_CARD` で移すだけにした。action を消さないので、残るカードの番号は変わらず、アーカイブしたカードもコメントも `board.ts show --archived` で読め、`move` で戻せる。別のコレクションへ移して action を消す案は採らなかった。消した `ADD_CARD` の分だけ番号が詰まらないよう番号を明示する必要があり、上の同時追加で番号が重なるため。kit のタグの絞り込みの件数にはアーカイブしたカードも入る

本文: [PLAYBOOK.md](./PLAYBOOK.md)
