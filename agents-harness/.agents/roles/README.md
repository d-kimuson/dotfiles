# Roles

Role は「Agent にどの立場で作業させるか」を定義したプロンプト。推奨する原則 ([principles](../principles/)) を frontmatter で列挙できる。`agent-core prompt <role> --type role` で本文を取り出し、SubAgent へ渡すタスクブリーフの先頭に置いて使う。

書き方のルールは [guidelines/harness.md](../guidelines/harness.md) を参照。

## 一覧

| role | 使うとき | 責務 |
| --- | --- | --- |
| [coordinator](./coordinator/ROLE.md) | 実装詳細を指定せず要求だけを投げる、複数タスクや大規模変更を統括したい | AC の導出、タスク分解と Role 割り当て、統合 |
| [product-engineer](./product-engineer/ROLE.md) | 対象が明確な実装・修正を任せたい | AC を満たす最小実装と自己検証 |
| [qae](./qae/ROLE.md) | 実装の受け入れ判定、リリース前の品質確認 | 独立検証と合否判定 |

## 選び方

- 1 タスクにつき採用する Role は常に 1 つ。複数の Role を混ぜない。
- ユーザーが指定しない場合は、依頼内容から適切な Role を 1 つ選ぶ。
- 実装詳細が未確定で、要求から AC を作る必要があるなら `coordinator`。AC が既にあるなら `product-engineer` か `qae` を直接使う。

## 渡し方

```sh
agent-core prompt coordinator --type role
```

`prompt` と `roles use` は、ROLE.md の frontmatter `principles` に挙げた原則の全文を、Role 本文の後ろに続けて出力する。

出力本文の後ろにタスクブリーフ（目的、入力コンテキスト、対象 AC、完了条件、制約、報告フォーマット）を続けて SubAgent に渡す。

- 委譲先は親の会話履歴を共有しない。対象パスと制約を明示する。
- 実装（`product-engineer`）には必ず検証（`qae`）を対にする。

## 検証

```sh
agent-core roles list        # 一覧
agent-core roles search qa   # 検索
agent-core principles list   # Role が推奨する原則の一覧
agent-core verify            # 構造と frontmatter の検証
```
