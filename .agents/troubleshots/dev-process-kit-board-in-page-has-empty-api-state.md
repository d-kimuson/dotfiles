# `<dpk-page>` の中の盤面は `el.api.state` が空になる

## Symptom

dev-process-kit 0.4.2 で、`<dpk-page>` の中に `<dpk-board-kanban>` を置き、`await el.api.ready` の後に `el.api.state` を読むと、base も draft も入らない `{}` が返る。ページの外に単体で置いた盤面では `state` が返るので、置き場所で挙動が変わる。

```js
const el = document.querySelector("dpk-page > dpk-board-kanban");
await el.api.ready;
el.api.state; // {}
```

## Workaround

draft を反映した列とカードは、要素の公開メソッド `el.items()` で読む。`columns` が列の配列で、各列は `id` と `cards` を持つ。カードは `id` と `tags` を持つ。

```js
const el = document.querySelector("dpk-page > dpk-board-kanban");
await el.api.ready;
const done = el.items().columns.find((column) => column.id === "done")?.cards ?? [];
```

`el.dispatchElementAction("MOVE_CARD", ["card", id], { column, before })` のような要素のアクションも、`items()` から読んだ id に対して使う。kit が描いた DOM (`.kanban-card[data-card]`) を読む方法もあるが、タグの絞り込みなどで DOM から外れたカードを拾えない。

## Why Not Fixed

kit が `<dpk-page>` の中の要素に `base: {}`・`storage: null` で controller を作り、draft をページに渡すためで、盤面の要素の `api.state` には何も残らない。0.4.2 の実装では `items()` が `reduceElementActions(authoredItems(), draft)` の結果を返す。`items()` は kit のドキュメントに書かれていない公開メソッドなので、バージョンを上げたら挙動を確かめ直す。
