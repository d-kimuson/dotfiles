---
description: 'feature-review gate の取得と承認を行なう'
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash(bd *), Bash(git *), Read
---

feature-review gate のチェックを行う。対象が複数ある場合は1件ずつ順に処理する。

## Steps

### 1. plan-review gate 待ち一覧を取得

```bash
bd ready --type 'gate' --label 'gate:feature-review'
```

対象がなければ "チェック待ちの gate はありません" と報告して終了


### 2. 動作確認を行なう

下記の steps を gate ごとに順次実行する

<steps>

1. gate のタイトル・説明を表示
2. 親 issue の AC を表示
3. ブランチがあれば切り替えて動作確認可能な状態にする:
  ```bash
  git switch 'beads/tasks/<issue-id>'
  ```
4. ユーザーに approve / NG を確認
5. approve の場合: 承認する
  ```bash
  bd gate close <gate-id> --reason "approved: LGTM"
  bd update <issue-id> --remove-label 'feature-review:ng' --add-label 'feature-review:approved'
  ```
5. NG の場合(軽微な変更で対応可能):
  文言修正など問題が明確で修正が軽微である場合、その場で修正を行い再度依頼することで approve に持っていく
  変更内容はコミットします
5. NG の場合(変更が大きい):
  bd-enginner が対応するタスクに積む
  ```bash
    bd gate close <gate-id> --reason "NG: <理由>"
    bd update <issue-id> --add-label 'feature-review:ng' --remove-label 'feature-review:approved' --status open
    bd comments add <issue-id> "feature-review で否認されました: <詳細>"
    ```

</steps>

## 3. clean up

すべて完了後 `git switch main` でブランチを元に戻す
