# リファインメントガイドライン

`bd ready --label 'step:plan'` で取得した issue すべての計画を上から順に行う。

## Steps

### 1. plan 待ち issues を取得

```bash
bd ready --label 'step:plan'
```

対象がなければ「対象なし」と報告して終了

### 2. リファインメント

下記の steps を issue ごとに順次実行する

<steps>
1. `bd show <id>` で詳細確認
2. 以下を判断・実行:
  - AC を設定する
  - E2E human-check が必要か判断し、必要なら `needs:feature-review` ラベルを付与
  - AC のユーザー確認が必要なら gate を作成:
    ```bash
    bd create "<issue-id>: AC確認" --type gate --labels 'gate:plan-review' --description "<確認内容>"
    bd dep add <issue-id> <gate-id>
    ```
  - ユーザー確認不要なら直接 implement に遷移:
    ```bash
    bd update <issue-id> --remove-label 'step:plan' --add-label 'step:implement' --acceptance '<AC>'
    ```
3. 次の issue へ
</steps>

### 3. レポート

最後に結果をレポートして完了
