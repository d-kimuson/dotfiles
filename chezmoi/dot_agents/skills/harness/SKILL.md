---
name: harness
description: Maintain the shared coding-agent prompt and skill layout, including canonical prompt storage, compatibility symlinks, and invocation metadata.
---

# Harness maintenance

- Store shared prompts canonically in `.agents/prompts/`.
- Keep tool-specific prompt directories as symlinks to the canonical directory:
  - `~/.claude/commands` → `~/.agents/prompts`
  - `~/.pi/prompts` → `~/.agents/prompts`
- Unless a prompt is explicitly intended for the agent to invoke autonomously, set `disable-model-invocation: true` in its frontmatter.
- Preserve the prompt's user-facing invocation with `user-invocable: true` unless the prompt is intentionally hidden from users.
- Keep one canonical source; do not duplicate prompt files under tool-specific directories.
- End every prompt body with `$ARGUMENTS` on its own trailing line so user-supplied command arguments are always received. Never omit it, even for prompts that currently take no arguments.
