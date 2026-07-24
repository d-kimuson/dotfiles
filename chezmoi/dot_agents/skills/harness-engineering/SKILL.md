---
name: harness-engineering
description: Design and maintain vendor-neutral coding-agent harnesses with AGENTS.md and Agent Skills. Use when creating, reviewing, or restructuring repository instructions, AGENTS.md files, Claude Code compatibility links, or skill directories.
---

# Harness Engineering

Use portable standards as the primary interface:

- Put repository-wide agent context in `AGENTS.md`.
- Put reusable domain knowledge and capabilities in Agent Skills.
- Do not introduce vendor-specific command or agent formats unless the user explicitly requires them.
- Isolate unavoidable vendor-specific configuration under `references/tools/<tool>/`.

Keep every automatically loaded file small. Retain only information required at that loading stage and defer task-specific details through explicit indexes.

Base every change on explicit user requirements and inspected project sources. Do not invent technologies, commands, files, target locations, or adjacent capabilities to make an example appear complete. When a required fact is unknown, keep an explicit placeholder or request the missing input instead of filling it from convention or path names.

## Required references

Read the reference that matches the artifact before editing it. This is mandatory: do not draft vendor syntax or portable file structure from memory.

- `AGENTS.md` or a compatibility link: [references/agents-md.md](references/agents-md.md)
- An Agent Skill or its directory: [references/skills.md](references/skills.md)
- Claude Code permissions: [references/tools/claude-code/permissions.md](references/tools/claude-code/permissions.md)
- Claude Code hooks: [references/tools/claude-code/hooks.md](references/tools/claude-code/hooks.md)

Load only references whose listed condition matches an artifact that will change. A tool-specific configuration task does not require the `AGENTS.md` or Agent Skills references unless those portable artifacts will also change. Do not traverse adjacent files for background context.

## Design boundaries

- Treat `AGENTS.md` and `SKILL.md` as runtime context, not maintenance documentation.
- Put activation criteria in the `description` and human-facing discovery in `README.md`; never restate when to use a skill in the `SKILL.md` body.
- Put human-facing maintenance information in `README.md`.
- Put details that are not needed for every activation in `references/` and index them with the condition for reading them.
- Turn repeated or sufficiently complex deterministic operations into tested scripts under `scripts/` instead of embedding long command sequences in prose.
- Put opt-in procedural runbooks under `workflows/`; keep the core skill focused on reusable knowledge.
- Preserve one canonical source for shared instructions and expose tool-specific filenames through symlinks where possible.
- Change only the requested harness capabilities; do not add unrelated permissions, hooks, workflows, or compatibility files.
