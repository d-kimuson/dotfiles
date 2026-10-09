# Context Map

<!-- decision: bounded-contexts
  決めること: Bounded Context の区分け (名前、責務、実装の場所) と、Context 間の関係 (どちらがどちらの概念に依存し、どこで変換するか)
  観察: ソースのモジュール・パッケージの切れ目、同じ言葉が別の意味で使われている箇所、モジュール間の import の向き、既存のドメインや用語のドキュメント
  書き方: 「Context | 責務 | 実装」の表と、「## 関係」の節に依存 1 つにつき 1 項目を書く。合意した Context ごとに、`docs/guidelines/writing/context.md` のテンプレートで `docs/contexts/<context>/CONTEXT.md` を作り、責務と、ユーザーと確認した用語と不変条件を書く。`knowledge/` と、選んだ機能に応じて `adr/`・`design-doc/` を `.gitkeep` 付きで作る。区分けが読み取れない部分は、推測で切らずにユーザーに聞く
-->
