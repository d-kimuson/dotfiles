---
name: handoff
description: 'コンテキスト圧迫時に次セッションへの引き継ぎファイルを作成する'
disable-model-invocation: true
user-invocable: true
allowed-tools: Edit, Write, Bash(git diff:*), Bash(git status:*), Bash(git log:*)
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to the `.agent/handoff.md`.

Include a "suggested skills" section in the document, which suggests skills that the agent should invoke.

Do not duplicate content already captured in other artifacts (PRDs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.

<constraints>
- `.agent/handoff.md` is a TEMPORARY file — never commit it
- If `.agent/handoff.md` already exists, READ it first and UPDATE it (preserve prior sessions, append new one)
- Write in English for token efficiency (except user-facing communication)
</constraints>

<template>

# HANDOFF: ${title}

## Behavioral Expectations

- This file is temporary — do NOT commit it
- Keep this file updated throughout the session
- When the user points out behavioral issues, document them here to prevent recurrence

<behavioral_notes>
(Record any user feedback about undesired behaviors to avoid repeating them)
</behavioral_notes>

## Context

**Goal**: (Overall objective of the task)

**Current Status**: (Where things stand right now)

## References

- (Relevant links, important file paths, documentation)

## Sessions

### Step {N}: (Brief title)

**What**: (What was done or is in progress)

**Facts discovered**:
- (Fact + evidence/source)

**Hypotheses**:
- (Current working assumptions)

**Decisions made**:
- (Key decisions and rationale)
</template>

<quality_criteria>
- Another session can resume work without asking clarifying questions
- All non-obvious facts include their source/evidence
- No stale or contradictory information from prior sessions
</quality_criteria>
