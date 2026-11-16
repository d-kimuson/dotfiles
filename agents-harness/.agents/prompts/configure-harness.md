---
name: configure-harness
description: configure-harness playbook で、リポジトリにコーディングエージェント向けのハーネスや auto-pilot を構成する
argument-hint: "[core|auto-pilot] [追加の指示]"
disable-model-invocation: true
user-invocable: true
---

`~/.agents/scripts/agent-core.ts playbooks use configure-harness` で playbook を取得し、その手順に従う。引数の先頭の語が setup (`core` / `auto-pilot`) に一致すればその setup にし、一致しないか省略時は `core` にする。残りは追加の指示として扱う。

---

$ARGUMENTS
