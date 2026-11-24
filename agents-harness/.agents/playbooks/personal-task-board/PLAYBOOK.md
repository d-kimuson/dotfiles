---
name: personal-task-board
description: 本人がやることを Personal Task Board に積む・動かす・見せるとき、または Task Board の brief を反映するときに使う
---

# Personal Task Board

本人がやること (判断、学習、作業) を 1 つの Kanban に集める。盤面の正は `~/.agents/state/personal-task-board/board.json` で、`public/index.html` は dev-process-kit の Kanban ページとして毎回生成する。

操作はすべて `node ~/.agents/playbooks/personal-task-board/scripts/board.ts` で行う。書き込むコマンドはページも生成し、最後にページの `file://` URL を出力する。

| コマンド | すること |
| --- | --- |
| `list` | 列ごとにカードを出力する |
| `add --column <id> --title <t> [--description d] [--tag t]... [--link 'url label']...` | 列の末尾にカードを足し、`TASK-<n>` を出力する |
| `move <n> --column <id>` | カードを列の末尾へ移す |
| `render [--fresh]` | ページを生成する。`--fresh` はページ上の下書きを捨てる |

列は `learning-backlog` (学習バックログ)、`todo`、`doing`、`done`。タグは `判断`・`学習`・`作業` から 1 つ付ける。`--link` は `http(s)` の URL だけを受け付けるので、ローカルのパスは description に書く。

カードを積んだ・動かしたら、ページの URL を本人に渡す。

## brief の反映

本人はページでカードを動かし、足し、編集して、brief を Agent に渡す。

1. brief の action を draft の順に `board.json` の `columns` へ反映する。action ごとの反映方法は dev-process-kit の Kanban の文書 (`https://raw.githubusercontent.com/d-kimuson/dev-process-kit/v<version>/docs/boards/kanban.md`、`<version>` は `board.ts` の `DPK_VERSION`) に従う。番号のない `ADD_CARD` には盤面の最大の番号の次を振る。
2. `render --fresh` を実行し、反映済みの下書きがページで再生されないようにする。
3. brief のコメントに答える。
