---
name: task-board
description: personal-task-board playbook で、Personal Task Board を開く・brief を反映する
argument-hint: [brief]
disable-model-invocation: true
user-invocable: true
---

`~/.agents/scripts/agent-core.ts playbooks use personal-task-board` で playbook を取得し、その手順に従う。引数が brief なら反映し、なければ `board.ts render` でページの URL を渡す。

---

$ARGUMENTS
