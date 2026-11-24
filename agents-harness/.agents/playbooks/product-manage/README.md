# product-manage

仕事モデル (https://claude.ai/artifact/SDRamdob1iKXw1bpp2jLmu) の Refine Loop の入口。`/product-manage` prompt はこれへの alias。

- 手動で実行し、5 件ほどを Personal Task Board に積む
- タスクの元は Context Store ではなく、プロジェクトごとのタスク管理元 (`./.agents/state/TASK_ORIGIN.md`)。盤面はプロジェクト横断の 1 つで、プロジェクト名のタグで絞る
- Software Factory の Audit Loop が出す issue は Product Backlog に直接入るので、ここでは扱わない
- 積んだタスクの詳細化 (`/refine`) はプロジェクトのハーネスが持ち、User Scope Harness には置かない

本文: [PLAYBOOK.md](./PLAYBOOK.md)
