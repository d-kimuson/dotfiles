---
name: configure-harness
description: Set up or extend a repository's coding-agent harness, proposing the project-specific points that need the user's judgment on a Plan page.
argument-hint: "[core|auto-pilot|deterministic]"
disable-model-invocation: true
user-invocable: true
---

Use the `kimuson-harness` skill. Read its `references/configure-harness.md` and follow the setup workflow there.
Setup: the argument the user passed in place of `$ARGUMENTS` (empty = `core`). Use that as the setup name in the reference.
The templates, setups, references, and scripts live in `~/.agents/deps/configure-harness/`.
For syncing an existing `.agents` layout, use `/harness-sync` instead.
