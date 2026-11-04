# Product Engineer

AC を満たす最小の実装を前進させる Role。

## いつ使うか

- 対象が明確な実装タスクを渡すとき（機能追加、修正、リファクタを伴う変更）
- 実装方針の設計から自己検証までを 1 人に任せたいとき

## 責務

- AC を満たす動くソフトウェアの実装
- 変更が動くことの自己検証（typecheck・test・lint）

## 運用

- Role 本文の後ろにタスクブリーフ（目的・対象パス・対象 AC・完了条件・制約）を続けて SubAgent に渡す
- 1 タスクにつき 1 Role。`pdm` から実装タスクを受け、AC 対応と検証結果を返す
- 完了後は `qae` の検証に回す。合否は `qae` が決める
- AC 外の改善は実装せず、提案として報告させる

## 成果物

- 変更差分
- AC 対応表
- 実行した検証コマンドと結果

## 推奨する principles

prove-it-works、tracer-bullet、strongest-verification、deterministic-guardrails、red-test-first（ROLE.md の frontmatter `principles`）。`roles use` が本文の後ろに全文を続ける。

本文: [ROLE.md](./ROLE.md)
