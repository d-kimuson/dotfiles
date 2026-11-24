# Personal Task Board

仕事モデル (https://claude.ai/artifact/SDRamdob1iKXw1bpp2jLmu) の Personal Task Board。Software Factory の外で、本人がやることを学習も含めて 1 か所に集める。`/task-board` prompt はこれへの alias。

- 積むのは `product-manage` (タスク管理元から拾ったタスク) と `retro` (学習バックログ)。学習バックログは本人が管理し、ほかの playbook からは読まない
- タスクはプロジェクト横断で 1 つの盤面に集め、プロジェクト名のタグで絞る
- 盤面は dev-process-kit の Kanban ページ。Learning Backlog は別の置き場にせず、同じ盤面の列にした
- `~/.agents/state/` は Git 管理外 (agents-harness の `.gitignore`)
- ページの `storage-key` に `board.json` の `revision` を含める。brief を反映した後に古い下書きが authored data の上で再生されるのを防ぐため

本文: [PLAYBOOK.md](./PLAYBOOK.md)
