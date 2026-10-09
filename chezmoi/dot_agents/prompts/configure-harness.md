---
name: configure-harness
description: Set up or extend a repository's coding-agent harness (AGENTS.md, docs/guidelines, review guideline, .agents/ skills and troubleshots) from proven templates, deciding every project-specific point with the user through a Grill page and a Delegation Poker page.
disable-model-invocation: true
user-invocable: true
---

# Configure Harness

The templates, references, and scripts live in `~/.agents/deps/configure-harness/`; the `templates/`, `references/`, and `scripts/` paths below are relative to it.

Bring the harness structure in `templates/` into the target repository. Fixed rules in the templates are copied as they are; every project-specific point is a decision block, decided with the user and then replaced by what it says to write.

## Templates

`templates/` mirrors the generated paths under three categories:

- `core/`: always generated.
- `stack/`: always generated, filled from what the repository shows.
- `optional/<feature>/`: generated only when the user picks the feature in the Grill.
  - `review-tools`: `REVIEW.md` (Claude Code Review) and `.github/copilot-instructions.md`. Offer only the tools the user uses; the Codex section is the `codex-review-section` decision in `AGENTS.md`.
  - `review-skill`: `.agents/skills/review/`.
  - `adr`, `design-doc`: the writing guides for those documents.
  - `bounded-context`: the Bounded Context division (`docs/CONTEXT-MAP.md`, `docs/contexts/<context>/`) and its writing guide. ADRs and Design Docs then split into cross-context and per-context locations.

Template directories named `agents/`, `github/`, or `claude/` stand for `.agents/`, `.github/`, `.claude/`. Always create `.agents/troubleshots/.gitkeep`.

A decision block looks like this:

```markdown
<!-- decision: <id>
  決めること: <what to decide>
  観察: <what to inspect in the repository>
  書き方: <how to write the result in place of the block>
-->
```

The fields are guidance, not a fixed question. Form the questions yourself from what you observed.

When a decision is settled, replace its block in one of three ways:

- Write the agreed content. When the repository does not show what a decision needs, ask the user in the Grill; never fill it with a guess.
- Remove the block, and its section when nothing else is left in it, when the user agrees it does not apply.
- Leave `<!-- TODO: <what is missing> -->` only when the user chooses to settle it later (for example, the verify commands of a repository that has no code yet).

## Scripts

Run with Node.js 24 or later from `~/.agents/deps/configure-harness/`.

- `node scripts/decisions.ts list [core|stack|optional/<feature>...]`: the decision blocks as JSON, with template and target paths.
- `node scripts/decisions.ts leftovers <path...>`: unresolved decision blocks (exit 1) and TODO comments in generated files.
- `node scripts/decisions.ts check`: validate the templates. Run it after changing a template.

## Steps

1. **Observe.** Read the existing harness (`AGENTS.md`, `CLAUDE.md`, `docs/`, `.agents/`, `.claude/`, `.github/`, review tool configs), `git log`, manifests, CI, and the scripts. For each decision from `list`, gather what its 観察 field asks for. If any harness file already exists, read `references/merge.md` now.
2. **Grill.** Read `references/grill.md`, then build the Grill page and iterate with the user until every decision and the optional features are settled.
3. **Delegation Poker.** Read `references/delegation.md`, then run the Delegation Poker page for the `delegation-defaults` decision.
4. **Generate and merge.** For each template, write the target file: keep the fixed text, and replace each decision block by what its 書き方 field says, using the agreed answer. If the repository already has harness files, show the plan described in `references/merge.md` before writing. Write every generated file in the agreed document language.
5. **Verify.** Run `leftovers` on the generated files; no decision block may remain. Check that every path in the AGENTS.md References table exists and that every symlink resolves. Report the generated files and every remaining TODO to the user.

## Pages

Build the Grill and Delegation Poker pages with the `dev-process-kit` skill. Publish them through the environment's standard way of showing a page to the user (for example, an Artifact in Claude Code); without one, write a local HTML file and give the user its path. Ask the questions on the pages, not in chat.
