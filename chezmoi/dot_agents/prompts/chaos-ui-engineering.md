---
name: chaos-ui-engineering
description: Adversarially explore a frontend with extreme UI patterns (very long text, unusual viewport widths, varied API responses), review captures with parallel SubAgents, and fix the real code until no issues remain.
disable-model-invocation: true
user-invocable: true
---

# Chaos UI Engineering

アプリケーションの Frontend にあえて複雑な/様々なUI表示パターン(非常に長いテキスト、特殊な画面幅...etc)を与え、敵対的に探索することでUIに関する問題をあぶり出し、修正を行う。

## 流れ

1. 最初に Frontend のみを起動し、自由に Backend のレスポンスを切り替える手段を確認する。Project にまだ存在しない場合は仕組みを用意する (SubAgent)
2. Frontend + 任意出力の API を構成できるようになったらとにかく大量の作業中の状態・画面幅・API Response のパターンを用意して無作為に Capture を集めていく
3. Capture は SubAgent を最大起動してチェックをさせて結果を受け取る
  - 分担して UI の崩れや、重複・z-index の意図しない順序、体験の劣化等を包括的にレビューし FB を集める

上記の FB を元に改善 Loop を回す。Frontend 側の実コードを修正し、報告された問題がなくなるまで修正と Chaos UI Engineering ステップを繰り返し UI の品質を高める

## ガイドライン

- 新しく用意したレスポンス切り替えの仕組みは、Project に残す。
- Loop は重大度に関係なく、報告された問題がゼロになるまで続ける。
- 仕様どおりか崩れか判断できない指摘は、Agent が判断して直し、最後に報告する。
- 再発防止のテスト (VRT・E2E) は追加しない。
