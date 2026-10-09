# Design Doc

実装前に、1 つの機能や変更の設計を合意するために書く。

## 配置と命名

- Context 横断: `docs/design-doc/YYYYMMDD-<name>.md`
- 1 つの Context に閉じる: `docs/contexts/<context>/design-doc/YYYYMMDD-<name>.md`
- `<name>` は kebab-case、日付は起票日。

<!-- decision: design-doc-location
  決めること: Design Doc の置き場所と命名
  観察: 既存の設計文書 (RFC、design、spec など) の場所と命名
  書き方: 既存の規約があれば上の項目をそれに合わせて書き換える。bounded-context を選ばなかったなら、最初の 2 項目を `docs/design-doc/YYYYMMDD-<name>.md` の 1 項目にまとめる。それ以外は何も書かない
-->

## 書かないもの

- コードや型定義を読めば分かる API の詳細
- ADR で決着済みの判断の再説明 (ADR のパスを示す)
- 目的に影響しない将来構想

## Alternatives の扱い

任意の節。実際に検討の土台に上がり、後から「なぜこちらを選ばなかったのか」という疑問が生まれやすい案がある場合に限り書く。該当しなければ節ごと省く。

## テンプレート

```markdown
# <タイトル>

## Goal

<この設計で実現すること。>

## Non-Goals

<スコープ外とすること。誤解されやすいものだけ書く。>

## Design

<設計の要点。>

## Alternatives

<任意。採らなかった案と、採らない理由。>
```
