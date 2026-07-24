# AGENTS.md

Use `AGENTS.md` as the canonical repository instruction file. Do not duplicate the same instructions across tool-specific files.

When Claude Code compatibility is required, create a relative symlink at the same level:

```sh
ln -s AGENTS.md CLAUDE.md
```

The target must remain `AGENTS.md`; do not make `CLAUDE.md` the source of truth.

## Required structure

Use the project name as the H1. Include exactly three required H2 sections: `Overview`, `Directory Structure`, and `References`. `Definition Of Done` is an optional fourth section; add it only when the project has invariant completion checks that should run by default.

````markdown
# <project-name>

## Overview

<Describe the project in a few short sentences.>

## Directory Structure

```text
.
├── <directory>/  # <responsibility>
├── <directory>/  # <responsibility>
└── <file>        # <role>
```

## Definition Of Done

- `<lint command>` passes.
- `<test command>` passes.

## References

References contain important instructions that are intentionally separated for progressive disclosure.
Always read every reference relevant to the task before making changes.

- [<topic>](docs/agents/<name>.md)
````

The template shows where the optional `Definition Of Done` section belongs. Omit the entire section when no suitable invariant checks exist; do not add it merely to complete the template.

## Section rules

### Overview

Describe the project, its purpose, and its primary boundaries in a few short sentences. Do not put setup steps, conventions, or maintenance history here. State only facts supported by the repository or user input; use placeholders when preparing a template from incomplete information.

### Directory Structure

Show a concise tree graph that explains the repository's overall shape. Include only paths needed to understand ownership and major boundaries; do not inventory every file. Add framework names and responsibility comments only when inspected sources establish them; a path name alone is not evidence. If no source establishes a path's responsibility, show the path without a comment.

### Definition Of Done

List checks that must pass for every applicable change without waiting for an explicit user request, such as lint, type checking, tests, or generated-file verification. Use exact commands when they are stable and runnable.

Because agents should run these checks routinely, keep them proportionate to the project and fast enough for the default development loop. Do not automatically require a full test suite in a very large project or an expensive E2E suite in an otherwise lightweight project. Choose scoped or lighter checks when they provide an appropriate default signal, and put heavyweight, task-specific, or conditional verification in a referenced guide instead.

### References

Start with the progressive-disclosure instruction shown in the template. Then list paths to focused guides that must be read when their topic becomes relevant.

Prefer an established project documentation location. If none exists, create focused files under `docs/agents/<name>.md` and link them here. Put the detailed rules in those files rather than copying them into `AGENTS.md`.

## Review checklist

- The H1 is the project name.
- The only H2 sections are `Overview`, `Directory Structure`, optional `Definition Of Done`, and `References`.
- The directory tree conveys boundaries without becoming an exhaustive inventory.
- `Definition Of Done` is absent unless suitable invariant checks exist.
- Definition-of-Done checks are explicit, executable, and light enough to run routinely for the project.
- Full-suite or E2E checks appear only when their cost is appropriate for the default development loop.
- The References preamble requires reading every relevant guide before related work.
- Shared instructions have one canonical source.
- Compatibility files are symlinks rather than duplicated copies where the filesystem permits them.
