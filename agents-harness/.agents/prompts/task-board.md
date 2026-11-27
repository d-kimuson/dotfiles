---
name: task-board
description: personal-task-board playbook で、Personal Task Board を開く・brief に答える
argument-hint: [brief]
disable-model-invocation: true
user-invocable: true
---

`~/.agents/scripts/agent-core.ts playbooks use personal-task-board` で playbook を取得し、その手順に従う。引数が brief なら答え、なければ盤面の URL を渡す。

---

$ARGUMENTS
