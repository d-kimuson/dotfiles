---
name: worker-advisor
description: worker-advisor playbook で、開始時と完了時に Frontier モデルへ相談しながらタスクを進める
argument-hint: <タスク>
disable-model-invocation: true
user-invocable: true
---

`~/.agents/scripts/agent-core.ts playbooks use worker-advisor` で playbook を取得し、その手順に従う。引数はタスクとして扱う。

---

$ARGUMENTS
