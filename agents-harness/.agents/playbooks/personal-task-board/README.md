# Personal Task Board

仕事モデル (https://claude.ai/artifact/SDRamdob1iKXw1bpp2jLmu) の Personal Task Board。Software Factory の外で、本人がやることを学習も含めて 1 か所に集める。`/task-board` prompt はこれへの alias。

- 積むのは、着手中のタスクを更新する Claude Code セッション (AGENTS.md のルール)、収集役 (`references/manage-user.md`)、`product-manage` (タスク管理元から拾ったタスク)、`retro` (学習バックログ)
- タスクはプロジェクト横断で 1 つの盤面に集め、プロジェクト名のタグで絞る。Learning Backlog は別の置き場にせず、同じ盤面の列にした
- 盤面は Claude Artifact に置いた dev-process-kit の Kanban。ローカルの `board.json` と `file://` のページをやめたのは、複数のセッションと本人が同じ盤面を同時に読み書きするため
- カードの正は Artifact の db の `actions` コレクションで、1 文書が draft action 1 つ。ページは `sync.js` の `serveDraftSync` に db を Transport として渡し、本人の編集も同じコレクションへ追記する。既存の文書を書き換えないので、別々のカードへの同時の更新は消えない。同じカードの description を同時に書き換えたときだけ、後の書き込みが勝つ
- Agent 側は `ArtifactData` で `actions` を読み、`scripts/board.ts` で dev-process-kit の Kanban と同じ規則で畳み込む。カード id はチケットの URL などの key のハッシュにして、セッションと収集役が同じタスクに同じ id を使い、重複した `ADD_CARD` は stale になる
- ページが db から消すのは、開いてから本人が足した action とコメントだけにした。kit の「すべてクリア」や古い action の削除・Undo をそのまま db に通すと、Agent や収集役が積んだカードまで消えるため
- カード 1 枚を db の 1 文書にする案は採らなかった。ページ側で kit の action を合成する transport が要り、claude.ai 上で確かめられない kit 内部への依存が増えるため
- `ADD_CARD` に番号を付けない。番号は再生の順に振られるので、同時に足しても衝突しない
- `assets/board.html` はカードを持たないので、全マシンで同じテンプレートから盤面を作れる。マシンごとの盤面の URL は `~/.agents/state/task-board/index.md` (Git 管理外) に置く
- action は溜まり続ける (db の上限は 25,000 文書)。上限に近づいたら、畳み込んだ盤面を base に書いたページを publish し、古い action を消す手順を足す

本文: [PLAYBOOK.md](./PLAYBOOK.md)
