# Deterministic guardrails

守らせたい規約を、自然言語でなく決定論的な仕組みで強制する原則。

## 設計メモ

- 「同じ指摘を 2 回したら仕組み化する」を、いつ動くかの判断基準にしている
- この harness 自体の方針 (静的に判定できるルールは linter や ast-grep で表す) と同じ考え方

## 推奨する Playbook

worker-advisor

本文: [PRINCIPLE.md](./PRINCIPLE.md)
