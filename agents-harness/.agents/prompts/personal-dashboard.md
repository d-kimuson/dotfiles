---
name: personal-dashboard
description: personal-dashboard playbook で、パーソナルダッシュボードを開く・ページでの変更とレビューコメントを反映する
argument-hint: [brief]
disable-model-invocation: true
user-invocable: true
---

`~/.agents/scripts/agent-core.ts playbooks use personal-dashboard` で playbook を取得し、その手順に従う。引数で反映を頼まれたか brief を渡されたら反映して答え、なければ盤面の URL を渡す。

---

$ARGUMENTS
