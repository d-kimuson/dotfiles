# Agent Skills

Follow the Agent Skills standard and keep the activation payload focused on execution-time knowledge.

## Directory structure

Use this structure:

```text
skills/<name>/
├── SKILL.md       # required: agent-facing runtime instructions
├── README.md      # required: user-facing discovery and maintenance
├── references/    # optional: details loaded only when relevant
├── scripts/       # optional: reusable deterministic operations
└── workflows/     # optional: opt-in procedural runbooks
```

`README.md` is a harness convention layered on top of the Agent Skills standard. It is required here to keep human-facing material out of `SKILL.md`.

## SKILL.md

Use only standard frontmatter unless a concrete runtime requirement justifies a vendor extension:

```markdown
---
name: <skill-name>
description: <What the skill does and when an agent should activate it.>
---

# <Skill title>

<Instructions required after activation.>
```

The `name` must match the directory name and use lowercase letters, numbers, and hyphens. The standard requires `name` and `description`; treat other fields as optional and check their portability before adding them.

Write the body in English because agents consume it as runtime context. Preserve proper nouns, language-sensitive literals, and requested expressions in their original language. For example:

```text
Use だ・である instead of です・ます.
```

Do not add a body section explaining when to activate the skill. Activation has already happened when the body is loaded, while discovery belongs in the frontmatter `description` and `README.md`.

Keep only knowledge and constraints needed on every activation in `SKILL.md`. Remove maintenance history, installation notes, exhaustive API documentation, and user-facing explanations. In examples or scaffolds, leave unspecified domain rules as explicit placeholders instead of inventing formats, commands, services, or policies.

## README.md

Write `README.md` in the user's language. It is for users and maintainers, not for the activated agent context.

Include concise information about:

- when a user should choose the skill;
- the high-level behavior to expect;
- the available workflows and what invoking each one does;
- maintenance notes needed to preserve the skill's structure.

Do not duplicate detailed agent instructions from `SKILL.md` or turn the README into a full operational manual.

## references/

Move information to `references/` when it is not needed on every activation. Add an index entry in `SKILL.md` that states both the path and the exact condition for reading it. A resource required for every execution of one operation is still conditional when the skill supports other operations; for example, load a parser reference when generating release notes, not when merely reviewing their prose.

```markdown
- Read `references/database-migrations.md` when a task changes the database schema.
```

Use focused files and reference them directly from `SKILL.md`. Avoid reference chains that force the agent to search several documents before finding the applicable rule.

Keep tool-specific material under `references/tools/<tool>/`. Do not let vendor-specific concepts define the top-level skill architecture.

## scripts/

Put skill-specific executable logic in `scripts/`. Prefer a script over prose commands when an operation is repeated, sufficiently complex, easy to perform inconsistently, or worth preserving as executable knowledge.

Scripts should be self-contained, declare dependencies, validate inputs, return actionable errors, and have automated tests when their behavior is non-trivial. Reference each script from `SKILL.md` only when the agent needs to run or modify it.

## workflows/

A skill primarily stores reusable knowledge, not a sequence that must always run. Put an opt-in, multi-step procedure in `workflows/<name>.md` when invoking a named operation should execute a defined series of actions, such as `create-draft-pr` in a GitHub skill.

Index each workflow from `SKILL.md` with its invocation condition. List all user-invocable workflows in `README.md` with a short description, because users decide when to invoke them.

## Review checklist

- `SKILL.md` and `README.md` both exist.
- Frontmatter uses the portable Agent Skills fields by default.
- The `SKILL.md` body is English except for proper nouns and language-sensitive literals preserved in their original language.
- `SKILL.md` contains only information useful after activation.
- `README.md` is written in the user's language and contains user-facing discovery and maintenance information.
- On-demand details have conditional index entries.
- Repeated complex operations are scripts rather than copied command sequences.
- Procedural runbooks live in `workflows/`, not in the core knowledge body.
- Vendor-specific material is isolated below `references/tools/<tool>/`.
