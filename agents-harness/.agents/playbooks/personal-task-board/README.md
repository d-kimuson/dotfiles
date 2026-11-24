# Personal Task Board

仕事モデル (https://claude.ai/artifact/SDRamdob1iKXw1bpp2jLmu) の Personal Task Board。Software Factory の外で、本人がやることを学習も含めて 1 か所に集める。`/task-board` prompt はこれへの alias。

- 積むのは `product-manage` (判断)、`retro` (学習バックログ)、`learn-it` (教材ができた学習) の各 playbook
- 盤面は dev-process-kit の Kanban ページ。Learning Backlog は別の置き場にせず、同じ盤面の列にした
- `~/.agents/state/` は Git 管理外 (agents-harness の `.gitignore`)
- ページの `storage-key` に `board.json` の `revision` を含める。brief を反映した後に古い下書きが authored data の上で再生されるのを防ぐため

本文: [PLAYBOOK.md](./PLAYBOOK.md)
