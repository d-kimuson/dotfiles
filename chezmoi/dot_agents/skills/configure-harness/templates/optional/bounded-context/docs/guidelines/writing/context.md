# Context Docs

Bounded Context ごとのドキュメント。

## CONTEXT-MAP.md

`docs/CONTEXT-MAP.md` に全 Context の一覧と、Context 間の関係 (どちらがどちらの概念に依存するか、どこで変換するか) を書く。

書かないもの: Context 内部の用語 (各 CONTEXT.md に書く)。

## CONTEXT.md

`docs/contexts/<context>/CONTEXT.md` にユビキタス言語と不変条件を書く。

- 用語ごとに、コード上の名前 (型名・値) と定義を 1 行で書く。
- 不変条件には、それを確かめているもの (テスト、型、証明やモデル) の所在を添える。

書かないもの:

- 実装の詳細 (コードに書く)
- 処理の流れや設計 (Design Doc に書く)
- 判断の理由 (ADR に書く)

```markdown
# <Context 名>

<Context の責務を 1〜2 文で。>

## Ubiquitous Language

| 用語 | コード | 定義 |
| ---- | ------ | ---- |

## Invariants

- <不変条件> (<確かめているテストや証明の所在>)
```

## knowledge/

`docs/contexts/<context>/knowledge/<topic>.md` に、Context の作業で繰り返し必要になる知識 (外部仕様、業務上の背景など) を 1 トピック 1 ファイルで置く。

書かないもの: 意思決定とその理由 (ADR に書く)、コードから追える実装の詳細。
