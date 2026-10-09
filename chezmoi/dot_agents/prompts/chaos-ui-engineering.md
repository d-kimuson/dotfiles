---
name: chaos-ui-engineering
description: Adversarially explore a frontend with extreme UI patterns (very long text, unusual viewport widths, varied API responses), review captures with parallel SubAgents, and fix the real code until no issues remain at the chosen level (strict / normal / lax).
argument-hint: "[strict|normal|lax] [追加の指示]"
disable-model-invocation: true
user-invocable: true
---

# Chaos UI Engineering

アプリケーションの Frontend にあえて複雑な/様々なUI表示パターン(非常に長いテキスト、特殊な画面幅...etc)を与え、敵対的に探索することでUIに関する問題をあぶり出し、修正を行う。

## 引数

引数の先頭の語をレベル (`strict` / `normal` / `lax`) として扱い、省略時と、先頭の語がどれにも一致しないときは `normal` にする。レベル以外の部分は対象の画面や観点などの追加の指示として扱う。

## レベル

| レベル | 用意するパターン | 修正する重大度 | 終了条件 |
| --- | --- | --- | --- |
| `strict` | 現実にはまず起きない極端な値まで大量に用意する | すべて | 報告された問題がゼロになる |
| `normal` | 現実に起こりうる境界値 (長い名前、空・大量件数、エラー、主要なブレークポイント)。最初のラウンドで決めた集合に固定する | 重大・中 | 固定した集合をすべて再 Capture して、重大・中の問題が報告されない |
| `lax` | 代表的なデータと画面幅。最初のラウンドで決めた集合に固定する | 重大 | 修正箇所の再 Capture で、重大な問題の解消を確認できる |

重大度は SubAgent が指摘ごとに付け、迷ったら低い方に付ける。SubAgent 間で同じ問題の重大度が食い違ったら Agent が決める。

- 重大: 操作できない、情報が読めない・欠ける (要素の重なりで隠れる、テキストが切れて意味を失う、画面全体の横スクロール、エラー時の白画面など)
- 中: 操作と情報は保たれるが、その画面の利用者が不具合だと気づく崩れ (はみ出し、z-index の不自然な順序、ローディング・空状態の欠如など)
- 軽微: 余白や揃えの小さなずれ、好みの範囲 (ボタンが数 px ずれるのは軽微、テキストがボタンに重なって読めないのは重大)

## 流れ

1. 最初に Frontend のみを起動し、自由に Backend のレスポンスを切り替える手段を確認する。Project にまだ存在しない場合は仕組みを用意する (SubAgent)
2. Frontend + 任意出力の API を構成できるようになったら、作業中の状態・画面幅・API Response のパターンをレベルに応じて用意し、Capture を集めていく
3. Capture は SubAgent を最大起動してチェックをさせて結果を受け取る
  - 分担して UI の崩れや、重複・z-index の意図しない順序、体験の劣化等を包括的にレビューし、重大度つきで FB を集める

上記の FB を元に改善 Loop を回す。修正する重大度の問題について Frontend 側の実コードを修正し、レベルの終了条件を満たすまで修正と Chaos UI Engineering ステップを繰り返し UI の品質を高める

## ガイドライン

- 新しく用意したレスポンス切り替えの仕組みは、Project に残す。
- 仕様どおりか崩れか判断できない指摘は、Agent が判断して直し、最後に報告する。
- 修正する重大度に入らなかった指摘は直さず、最後に重大度つきの一覧で報告する。
- 再発防止のテスト (VRT・E2E) は追加しない。

---

$ARGUMENTS
