# Personal Task Board

仕事モデル (https://claude.ai/artifact/SDRamdob1iKXw1bpp2jLmu) の Personal Task Board。Software Factory の外で、本人がやることを学習も含めて 1 か所に集める。`/task-board` prompt はこれへの alias。

- 積むのは、着手中のタスクを更新する Claude Code セッション (AGENTS.md のルール)、収集役 (`references/manage-user.md`)、`product-manage` (タスク管理元から拾ったタスク)、`retro` (学習バックログ)
- タスクはプロジェクト横断で 1 つの盤面に集め、プロジェクト名のタグで絞る。学習バックログは同じ Artifact の別ページの Kanban (`personal-learning`) にした。タスクの列に混ぜると、今日やることを選ぶときに学習のカードが邪魔になるため
- 列は Todo・今日やる・進行中・ブロック・Done。今日やるは本人が朝に選ぶ列で、Agent は動かさない
- カードは説明・ブロック理由・セッションの参照・リンクだけを持つ。経緯の記録 (前の形式の `## 状況`) と担当者はやめた。状態は列が表し、盤面の持ち主は本人 1 人であるため。ページは担当者と Status の欄を Shadow DOM への style で隠す
- セッションの参照は、web のセッションは claude.ai の URL をリンクに、ローカルのセッションは `<provider> <session id>` を description に置く。どのセッションで進めたかを後から辿るため
- ページの下の欄に、列ごとの枚数・ブロック中のカードと理由・最近動いたカードを db の action から出す。kit の `el.api.state` は sync を使うページで空なので、ページが action を自前で畳む
- 盤面は Claude Artifact に置いた dev-process-kit の Kanban。ローカルの `board.json` と `file://` のページをやめたのは、複数のセッションと本人が同じ盤面を同時に読み書きするため
- カードの正は Artifact の db の `actions` コレクションで、1 文書が draft action 1 つ。ページは `sync.js` の `serveDraftSync` に db を Transport として渡し、本人の編集も同じコレクションへ追記する。既存の文書を書き換えないので、別々のカードへの同時の更新は消えない。同じカードの description を同時に書き換えたときだけ、後の書き込みが勝つ
- Agent 側は `ArtifactData` で `actions` を読み、`scripts/board.ts` で dev-process-kit の Kanban と同じ規則で畳み込む。カード id はチケットの URL などの key のハッシュにして、セッションと収集役が同じタスクに同じ id を使い、重複した `ADD_CARD` は stale になる
- ページが db から消すのは、開いてから本人が足した action とコメントだけにした。kit の「すべてクリア」や古い action の削除・Undo をそのまま db に通すと、Agent や収集役が積んだカードまで消えるため
- カード 1 枚を db の 1 文書にする案は採らなかった。ページ側で kit の action を合成する transport が要り、claude.ai 上で確かめられない kit 内部への依存が増えるため
- `ADD_CARD` に番号を書かず、kit が再生の時に振る番号に任せる。番号を明示すると、ページと Agent が同時に足したときに番号が重なり、後の `ADD_CARD` が stale になってカードが失われるため
- `assets/board.html` はカードを持たないので、全マシンで同じテンプレートから盤面を作れる。マシンごとの盤面の URL は `~/.agents/state/task-board/index.md` (Git 管理外) に置く
- アーカイブは、Done のカードをページが CSS で隠す最後の列 `archived` へ `MOVE_CARD` で移すだけにした。action を消さないので、残るカードの番号は変わらず、アーカイブしたカードもコメントも `board.ts show --archived` で読め、`move` で戻せる。別のコレクションへ移して action を消す案は採らなかった。消した `ADD_CARD` の分だけ番号が詰まらないよう番号を明示する必要があり、上の同時追加で番号が重なるため。kit のタグの絞り込みの件数にはアーカイブしたカードも入る

本文: [PLAYBOOK.md](./PLAYBOOK.md)
