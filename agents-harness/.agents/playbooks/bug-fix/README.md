# Bug fix

不具合を再現し、原因を実行時の証拠で絞って修正する playbook。

pstack の `poteto-mode/playbooks/bug-fix.md` を下敷きにした。

## 原則との関係

回帰テストの扱い (手順 6) は原則 `red-test-first` に従う。テストが書けない・高コストなときは理由を述べて省く、という逃げ道も原則側と同じ。

## 意図的に省いたもの

- 一般的な進め方（調査から修正、検証までの流れ）。本文は、甘くなりやすい合格基準と証拠、委譲先、返答の形に絞った
- Cursor 専用の要素: control skill、`/loop`、モデルの slug 指定、PR の作成と運用（Opening a PR）
- このハーネスに無い skill への参照: how、why、architect、tdd、interrogate
- 「自分は計画とレビューに徹し、調査と修正を委譲する」という体制の指定。委譲は AGENTS.md の行動原則と「Agent の呼び出し」に従う

本文: [PLAYBOOK.md](./PLAYBOOK.md)
