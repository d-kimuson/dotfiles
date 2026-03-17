---
description: 'plan-review gate の AC 確認と approve/NG 操作'
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash(bd *), Read
---

plan-review gate（AC 確認）のチェックを行う。対象が複数ある場合は1件ずつ順に処理する。

## Steps

### 1. plan-review gate 待ち一覧を取得

```bash
bd ready --type 'gate' --label 'gate:plan-review'
```

対象がなければ「AC 確認待ちの gate はありません」と報告して終了

### 2. AC 確認

下記の steps を gate ごとに順次実行する

<steps>
1. gate の説明（提案された AC）を表示
2. 親 issue の description を表示
3. ユーザーに AC の approve / フィードバックを確認
4. approve の場合:
   ```bash
   bd gate close <gate-id> --reason "approved: <サマリ>"
   bd update <issue-id> --remove-label 'step:plan' --add-label 'step:implement' --acceptance '<確定した AC>'
   ```
5. フィードバックがある場合:
   - ユーザーと対話して AC を修正
   - 合意後に上記 approve フローを実行
6. 次の gate へ
</steps>
