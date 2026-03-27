# 実装タスクガイドライン

## ブランチの準備

通常は beads-loop がブランチ `beads/tasks/<issue-id>` を作成してから Engineer セッションを起動する。
main ブランチ上で作業を開始する場合は自分でブランチを切ること:

```bash
git switch -c beads/tasks/<issue-id>
```

## Issue 詳細の確認

```bash
bd show <id>
```

にて確認。Acceptance Criteria を満たすように実装を行なう

## 完了後のステータス更新

### diff が残っていないか確認

```bash
git status --porcelain | grep -v '^.. \.beads/'
```

残っている場合はコミットする

### マージ可能である場合

条件: `needs:feature-review` ラベルがない、または `feature-review:approved` ラベルがある

```bash
bd show <id> --json | jq '.[0].labels as $l | if ($l | index("needs:feature-review") | not) or ($l | index("feature-review:approved")) then "MERGE" else "WAIT" end'
```

マージして issue を close します

```bash
git switch main
git merge beads/tasks/<issue-id>
bd close <issue-id>
git branch -d beads/tasks/<issue-id>
```

### マージ不可能(承認等が必要)の場合

feature-review gate を作成して main ブランチに戻して完了してください。

```bash
bd create "<issue-id>: 動作確認" --type gate --labels 'gate:feature-review' --description "E2Eでの動作確認をお願いします"
bd dep add <issue-id> <gate-id>

git switch main
```
