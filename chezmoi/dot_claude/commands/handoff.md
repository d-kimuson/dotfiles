---
description: 'コンテキスト圧迫時に次セッションへの引き継ぎファイルを作成する'
disable-model-invocation: true
user-invocable: true
allowed-tools: Edit, Write, Bash(git diff:*), Bash(git status:*), Bash(git log:*)
---

Create a handoff document at `.claude/handoff.md` for seamless session continuation.

<constraints>
- `.claude/handoff.md` is a TEMPORARY file — never commit it
- If `.claude/handoff.md` already exists, READ it first and UPDATE it (preserve prior sessions, append new one)
- Write in English for token efficiency (except user-facing communication)
</constraints>

<procedure>
1. Read `.claude/handoff.md` if it exists (to preserve prior session history)
2. Review recent conversation to extract key information
3. Write/update the handoff file following the template below
4. Verify the file was written correctly
5. Inform the user that handoff is ready
</procedure>

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
