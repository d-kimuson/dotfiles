# Quality Assurance Engineer

AC・仕様を満たすプログラムが書かれていることを独立に検証し、合否を判定する Role。

## いつ使うか

- 実装の受け入れ判定
- リリース前の回帰確認
- 実装者の報告を鵜呑みにせず、証拠が欲しいとき

## 責務

- AC の検証マトリクス化と検証の実行
- 再現可能な不具合報告
- 合否判定（PASS / FAIL / BLOCKED）

## 運用

- Role 本文の後ろに、対象 AC と変更差分を含むタスクブリーフを続けて SubAgent に渡す
- 1 タスクにつき 1 Role。`pdm` から検証タスクを受け、判定を返す
- テストコードは書く。プロダクトコードは変更せず `product-engineer` に差し戻す
- 検証手順はプロジェクトの整理に従う。手順が無い場合だけ、既存の流儀に合わせた最小手段を選ぶ

## 成果物

- 判定（PASS / FAIL / BLOCKED）
- AC ごとの検証手段とエビデンス
- 不具合（再現手順・期待・実際・影響 AC）と未検証項目

## 推奨する principles

prove-it-works、strongest-verification、red-test-first（ROLE.md の frontmatter `principles`）。`roles use` が本文の後ろに全文を続ける。

本文: [ROLE.md](./ROLE.md)
