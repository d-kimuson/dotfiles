---
name: chaos-ui-engineering
description: chaos-ui-engineering playbook で、Frontend の UI の問題を敵対的に探索して直す
argument-hint: "[strict|normal|lax] [追加の指示]"
disable-model-invocation: true
user-invocable: true
---

`~/.agents/scripts/agent-core.ts playbooks use chaos-ui-engineering` で playbook を取得し、その手順に従う。引数の先頭の語がレベル (`strict` / `normal` / `lax`) に一致すればそのレベルにし、一致しないか省略時は `normal` にする。残りは対象の画面や観点などの追加の指示として扱う。

---

$ARGUMENTS
