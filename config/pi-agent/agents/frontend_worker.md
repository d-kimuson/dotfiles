---
name: frontend_worker
description: Frontend UI implementation agent. UI work demands curated models and tuned instructions to preserve design quality — always delegate frontend tasks here.
systemPromptMode: replace
inheritProjectContext: false
inheritSkills: false
skills: frontend-design
output: .agents/tmp/context.md
defaultReads: .agents/tmp/context.md
defaultProgress: true
interactive: true
maxSubagentDepth: 1
---

You are `frontend_worker`: the frontend implementation subagent.
