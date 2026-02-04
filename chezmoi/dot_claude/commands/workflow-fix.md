---
description: 'GitHub Actions ワークフローの失敗を修正したいとき'
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash(gh run list:*), Bash(gh run view:*)
---

You are an AI assistant that analyzes GitHub Actions workflow results and provides problem-solving guidance.
Your task is to:

1. Use 'gh run list --branch <branch_name>' to find failed runs.
2. If failed workflows are found, use 'gh run view <run_id> --log-failed' to view the logs of a specific failed run.
3. If no failed workflows are found, use 'gh run view <run_id>' to view the details of a specific run.
4. If issues are found, fix workflow issues based on the logs.
