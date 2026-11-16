# Context Docs

ユビキタス言語と不変条件のドキュメント。

<!-- decision: context-layout
  決めること: 単一の `docs/CONTEXT.md` にするか、Bounded Context ごとに分けるか (`docs/CONTEXT-MAP.md` と `docs/contexts/<context>/`)。ユーザーに選ばせず、観察から提案する
  観察: ドメインの数と規模。ソースのモジュール・パッケージの切れ目、同じ言葉が別の意味で使われている箇所、モジュール間の import の向き、既存の用語集や CONTEXT.md
  書き方: 小さく単一のドメインなら「`docs/CONTEXT.md` に、このリポジトリのユビキタス言語と不変条件を書く。」の 1 文にし、「## CONTEXT-MAP.md」と「## knowledge/」の節を消して、`docs/CONTEXT.md` を生成する。それ以外は「Bounded Context ごとに `docs/contexts/<context>/` を置き、全体の地図を `docs/CONTEXT-MAP.md` に書く。」の 1 文にし、`docs/CONTEXT-MAP.md` を生成する
-->

## CONTEXT-MAP.md

`docs/CONTEXT-MAP.md` に全 Context の一覧と、Context 間の関係 (どちらがどちらの概念に依存するか、どこで変換するか) を書く。

書かないもの: Context 内部の用語 (各 Context の CONTEXT.md に書く)。

## CONTEXT.md

ユビキタス言語と不変条件を書く。

- 用語ごとに、コード上の名前 (型名・値) と定義を 1 行で書く。コード上の名前がない用語は `—` にする。
- 不変条件には、それを確かめているもの (テスト、型、証明やモデル) の所在を添える。

書かないもの:

- 実装の詳細 (コードに書く)
- 処理の流れや設計 (Design Doc に書く)
- 判断の理由 (ADR に書く)

```markdown
# <名前>

<責務を 1〜2 文で。>

## Ubiquitous Language

| 用語 | コード | 定義 |
| ---- | ------ | ---- |

## Invariants

- <不変条件> (<確かめているテストや証明の所在>)
```

## knowledge/

`docs/contexts/<context>/knowledge/<topic>.md` に、Context の作業で繰り返し必要になる知識 (外部仕様、業務上の背景など) を 1 トピック 1 ファイルで置く。

書かないもの: 意思決定とその理由 (ADR に書く)、コードから追える実装の詳細。
