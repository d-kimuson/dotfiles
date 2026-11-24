---
name: product-manage
description: プロジェクトのタスク管理元から本人がやるタスクを選び、Personal Task Board に積むときに使う
---

# product-manage

カレントのプロジェクトのタスク管理元から、本人がやるタスクを 5 件ほど選び、Personal Task Board に積む。盤面の操作は `~/.agents/playbooks/personal-task-board/PLAYBOOK.md` に従う。

1. `./.agents/state/TASK_ORIGIN.md` を読む。タスク管理元 (Jira、Linear、GitHub Issues など)、読むツール、対象の絞り込み (プロジェクト、担当者、ラベルなど) が書かれている。ファイルがなければ本人に聞いて作る。
2. タスク管理元から、絞り込みに当たる未完了のタスクを読む。
3. `board.ts list` で盤面を見て、既にカードがあるタスクを候補から外す。
4. 候補を、他の人や作業を止めている度合いと期日で並べ、5 件ほどに絞る。ほかのタスクの前提になるものを先にする。
5. 1 件ずつ `todo` 列に `--project` を付けて積む。タグは本人の判断が要るなら `判断`、それ以外は `作業`。title はタスク管理元のタイトル、description にやることと止まっているもの、`--link` にタスクの URL を付ける。
6. 選ばなかった候補を 1 行ずつ挙げ、ページの URL と一緒に本人に渡す。
