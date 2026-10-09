# `claude-code/testing` の stub が期待する戻り値の形を外すと想定外の理由でテストが失敗する

## Symptom

mods プラグインのテスト (`claude-code/testing` の `test`/`on`) で、`session.compact` の stub が返す `messages` の各要素に `toolUses` を付け忘れると、意図したアサーションではなく hook がスキップされた旨のエラーになる。

```
AssertionError: expect(received).toEqual()

Expected: ["compact: keep the plan", "submit: continue step 3"]
Received: [
  "compact: keep the plan",
  "submit: The context compaction failed: test: next() passed an argument with messages that are not a list\n\ncontinue step 3"
]

the engine reported:
  test's session.compact hook was skipped: test: returned messages[0] that has toolUses that are not a list of { tool_use_id, tool, input }
  test's session.compact hook was skipped: test: next() passed an argument with messages that are not a list
```

同様に、`tool.register` のような「本番コードが呼ぶ API」を差し替える stub は `{ value: {...} }` で包んで返す必要がある。`session.compact` や `turn.complete` のような「イベントの結果」を返す stub はそのまま値を返す。この 2 種類の規約を混同しやすい。

## Workaround

- `session.compact` の stub が返す各 message には必ず `toolUses: []` (またはツール呼び出しの配列) を付ける。
- API を差し替える stub (`tool.register` など) は `{ value: <本来の戻り値> }` で返す。実例は `chezmoi/dot_claude/local-plugins/self-compact/tests/self-compact.test.ts`。
- アサーションが期待と違う値で落ちたら、まず `the engine reported:` 以下のログを見る。stub の形が原因であることが多い。

## Why Not Fixed

`claude-code/testing` (mods) は early access の外部パッケージで、この規約は変更できない。
