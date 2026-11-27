---
name: coordinate-task
description: coordinate-task playbook で、要求を正確に理解して worker-advisor で worker に依頼する
argument-hint: <要求>
disable-model-invocation: true
user-invocable: true
---

`~/.agents/scripts/agent-core.ts playbooks use coordinate-task` で playbook を取得し、その手順に従う。引数はユーザーの要求として扱う。

---

$ARGUMENTS
