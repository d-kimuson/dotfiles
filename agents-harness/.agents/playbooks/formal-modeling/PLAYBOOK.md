---
name: formal-modeling
description: 形式検証の手法を設計するとき、または並行処理・状態遷移・プロトコルなど example test では網羅できない問題を、モデルで見つけて直したいときに使う
---

# Formal modeling

対象に合うパターンを選び、モデルで性質を検証し、モデルと実装の対応をテストで確かめる。プロジェクトが既に TLA+、Alloy、P、property-based testing の stateful モデルなどを採用しているなら、パターンの手法をそちらに差し替える。

## パターン

| 対象 | 手法 | 手順 |
| --- | --- | --- |
| Web application backend の集約とトランザクション | Quint でモデル化し、MBT で実装と突き合わせる | [references/backend-mbt.md](./references/backend-mbt.md) |
| 状態や並行性は無いが、pure なロジックが複雑 | Lean で証明し、差分テストで実装と突き合わせる | [references/lean.md](./references/lean.md) |
| 手元で再現できない複数コンポーネントの連携 | Quint でモデル化し、反例を単体テストに写す | [references/integration.md](./references/integration.md) |
| 上のどれにも当たらない並行処理・状態遷移の不具合 | Quint で反例を見つけ、example test に写して直す | [references/quint.md](./references/quint.md) |

## 共通の規則

- 守りたい性質を先に決め、モデルにはその性質に効く状態と遷移だけを入れる。
- モデルが正しくても、実装が正しいとは限らない。各パターンの「実装との対応」のテストまで通して完了にする。
- 判定はコマンドの exit code で行う。各パターンの末尾に挙げたコマンドを、Feedback Cycle の指標にする。
- モデルをコミットするかはプロジェクトの方針に従う。方針が無く、継続して回さないモデルは残さない。

## 返答

検証した性質、モデルの範囲、判定コマンドとその出力、見つかった反例と対応を述べる。
