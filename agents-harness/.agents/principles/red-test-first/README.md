# Red test first

不具合は、失敗する再現テストを先に用意してから直す原則。

## 設計メモ

- テストが書けない・高コストなときの逃げ道を本文に明記している (省くなら理由を述べる)。playbook `bug-fix` の回帰テストの扱いは、この原則に従う

## 推奨する Playbook

worker-advisor

本文: [PRINCIPLE.md](./PRINCIPLE.md)
