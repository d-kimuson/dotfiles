---
name: handoff
description: 作業を伴うセッションの開始時に handoff ファイルを作り、セッション中に更新し続ける
---

# Handoff

Keep a handoff file so that a fresh agent can continue the work after this session ends or its context is compacted.

## Create

Before starting the work, run in the current directory:

```bash
node ~/.agents/playbooks/handoff/scripts/new.ts
```

It creates `.agents/handoff/<yyyymmddHHMMSS>-<uuid>/index.md` from the template, keeps it out of Git, and prints the path. Fill in the title, Goal and Current Status.

If the user names an existing handoff file to continue from, read it and keep writing to it instead, adding a new Step.

## Update

- Update the file throughout the session: after each meaningful step, decision or discovery, and before the context is compacted.
- When the user points out a behavioral issue, record it in Behavioral Notes.
- Do not duplicate content already captured in other artifacts (PRDs, plans, ADRs, issues, commits, diffs). Reference them by path or URL.
- Redact sensitive information such as API keys, passwords and personally identifiable information.
- Write in English, except quotes of the user.
- Never commit the file.

## Quality criteria

- Another session can resume the work without asking clarifying questions.
- Every non-obvious fact includes its source or evidence.
- No stale or contradictory information remains from earlier steps.
