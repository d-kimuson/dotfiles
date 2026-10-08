# ADR

1 つの意思決定と、その理由を残す。

## 配置と命名

- `docs/adr/YYYYMMDD-<name>.<status>.md` に置く。
- `<name>` は kebab-case、日付は起票日。
- `<status>` は `proposed` / `accepted` / `rejected` / `deprecated` / `superseded` のいずれか。ステータスが変わったら `git mv` でファイル名を変える。`superseded` にしたら、置き換えた ADR のパスを本文の先頭に足す。

## 書かないもの

- 検討の経緯の時系列
- 実装手順やコードの説明 (Design Doc かコードに書く)

## Alternatives の扱い

任意の節。実際に検討の土台に上がり、後から「なぜこちらを選ばなかったのか」という疑問が生まれやすい案がある場合に限り書く。該当しなければ節ごと省く。

## テンプレート

```markdown
# <決定を表すタイトル>

## Context

<決定が必要になった状況と制約。>

## Decision

<何を決めたか。>

## Consequences

<この決定で受け入れるトレードオフ。>

## Alternatives

<任意。採らなかった案と、採らない理由。>
```
