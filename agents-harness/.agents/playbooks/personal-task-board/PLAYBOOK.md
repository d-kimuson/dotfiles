---
name: personal-task-board
description: 本人がやることをパーソナルダッシュボードに積む・動かす・見せるとき、またはページでの本人の変更とレビューコメントを反映するときに使う
---

# パーソナルダッシュボード

本人がやること (判断、作業) を 1 つの Kanban に、学習を同じ文書の別のページの Kanban (学習バックログ) に集める。盤面は folio の HTML 文書 `/projects/パーソナルダッシュボード/personal-dashboard.html` で、読み書きは `~/.agents/references/task-board.md` に従う。

- 盤面を見せる: `~/.agents/state/personal-dashboard/index.md` の URL を本人に渡す。無ければ `task-board.md` の「index.md が無いとき」で用意する
- 積む・動かす: `task-board.md` の「書く」で行い、最後に URL を本人に渡す
- Done を片付ける: 本人に頼まれたら `task-board.md` の「アーカイブ」で行う
- 本人から盤面の反映を頼まれたとき (「変更・コメントをコピー」の brief を貼られたときを含む): `task-board.md` の「レビューコメントに応える」で、ページでの変更を base に反映し、レビューコメントに応える
