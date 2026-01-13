---
name: github-workflow
description: GitHubと連携した作業を効率的に行うためのスキル
---

## gh cli の利用

GitHubのリソース(Issues, PR, ...etc)へのアクセスは認証が必要である場合が多いため、gh cli を利用してアクセスします。これは URL を渡された場合も常に gh cli でのアクセスに読み替えて実施します。

## PR の CI チェック

タスクの完了条件としてPRのCI監視と結果を確認する必要がある場合は専用のスクリプトを実行することで待機とレポートを受け取ります。

```bash
<skills-directory>/scripts/wait-pr-checks-and-report.sh <PR_NUMBER>
```
