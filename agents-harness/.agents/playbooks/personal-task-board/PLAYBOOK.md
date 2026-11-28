---
name: personal-task-board
description: 本人がやることを Personal Task Board に積む・動かす・見せるとき、または Task Board の brief を受け取ったときに使う
---

# Personal Task Board

本人がやること (判断、作業) を 1 つの Kanban に、学習を同じ Artifact の別のページの Kanban (学習バックログ) に集める。盤面は Claude Artifact で、読み書きは `~/.agents/references/task-board.md` に従う。

- 盤面を見せる: `~/.agents/state/task-board/index.md` の URL を本人に渡す。無ければ `task-board.md` の「index.md が無いとき」で用意する
- 積む・動かす: `task-board.md` の「書く」で行い、最後に URL を本人に渡す
- Done を片付ける: 本人に頼まれたら `task-board.md` の「アーカイブ」で行う
- brief やコメントを受け取ったとき: ページでの変更は既に盤面に入っている。反映し直さず、brief のコメントに答える。カードへの依頼があれば `task-board.md` の「書く」で応える
