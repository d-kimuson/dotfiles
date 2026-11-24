---
name: catchup
description: catchup playbook で、前回以降の Slack や社内ドキュメントの変化をダイジェストにする
argument-hint: [期間]
disable-model-invocation: true
user-invocable: true
---

`~/.agents/scripts/agent-core.ts playbooks use catchup` で playbook を取得し、その手順に従う。引数は対象の期間として扱う。

---

$ARGUMENTS
