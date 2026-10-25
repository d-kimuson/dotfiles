---
name: harness-sync
description: Check and create the project-scope symlinks that expose .agents/skills and .agents/prompts to Claude Code, Command Code, Pi, OpenCode, and Cursor.
argument-hint: "[--check] [--dry-run] [--tool <name>]"
disable-model-invocation: true
user-invocable: true
---

# Harness Sync

Use the `kimuson-harness` skill. Read its `SKILL.md` and `references/sync.md` if the script reports a conflict or an unfamiliar path.

Run the sync script from the current project root:

```bash
bash ~/.agents/skills/kimuson-harness/scripts/sync-harness.sh $ARGUMENTS
```

Replace `$ARGUMENTS` with the flags the user passed after `/harness-sync`; leave it empty when there are none.

- Default: check and create project-scope symlinks.
- `--check`: report only; exit 1 when anything is missing or conflicting.
- `--dry-run`: show what would be created without changing files.
- `--tool claude|command-code|pi|opencode|cursor`: limit to one tool.

Rules:

- Do not delete a real directory or replace a symlink that points elsewhere. The script reports these as conflicts; explain the migration steps from `references/sync.md` instead.
- Do not create `.commandcode/skills`; Command Code reads `.agents/skills` natively.
- Do not create `.agents/AGENTS.md` as project memory; use the project-root `AGENTS.md`.
- Pi project prompts are `.pi/prompts`, not `.pi/agent/prompts`.

Report the created links, already-valid links, conflicts, and native paths that need no link.
