---
name: configure-harness
description: リポジトリにコーディングエージェント向けのハーネス (AGENTS.md、REVIEW.md、docs/guidelines/) を構成する
---

# Configure Harness

Bring a coding agent harness into a repository from the `agent-harness` recommended pattern, filling in every project-specific point from what the repository shows.

Paths in this playbook are relative to `~/.agents/playbooks/configure-harness/`, except the pattern, which is `~/.agents/references/shared/recommended-patterns/agent-harness/`.

## Pattern

Read the pattern's `index.md` before anything else. It says what must exist first, what to observe, when to propose each optional unit, what the Plan page always shows, and what to do beyond the steps below. Where it differs from this file, follow it.

Bring the harness structure in the pattern's `template/` into the target repository. Fixed rules in the templates are copied as they are; every project-specific point is a decision block, proposed from what the repository shows, and then replaced by what it says to write. The proposals that need the user's intent or can swing are reviewed on the Plan page.

## Templates

`template/` is the tree generated in the target repository, at the same paths. Always generate a template file unless it carries the `.optional` marker:

- A file named `<name>.optional.<ext>` is an optional unit, generated as `<name>.<ext>`.
- A directory named `<name>.optional/` is an optional unit as a whole, generated as `<name>/`.

The pattern's `index.md` says when to propose each optional unit.

A decision block looks like this:

```markdown
<!-- decision: <id>
  決めること: <what to decide>
  観察: <what to inspect in the repository>
  書き方: <how to write the result in place of the block>
-->
```

The fields are guidance, not a fixed question. Form the proposal yourself from what you observed.

When a decision is settled, replace its block in one of three ways:

- Write the agreed content. When the repository does not show what a decision needs, ask the user on the Plan page; never fill it with a guess.
- Remove the block, and its section when nothing else is left in it, when the decision does not apply.
- Leave `<!-- TODO: <what is missing> -->` only when the user chooses to settle it later (for example, the verify commands of a repository that has no code yet).

## Scripts

Run with Node.js 24 or later.

- `node scripts/decisions.ts files`: every template file as JSON, with its target path and the optional unit it belongs to.
- `node scripts/decisions.ts list`: the decision blocks as JSON, with template and target paths and optional unit.
- `node scripts/decisions.ts leftovers <path...>`: unresolved decision blocks (exit 1) and TODO comments in generated files.
- `node scripts/decisions.ts check`: validate the templates. Run it after changing a template.

## Steps

1. **Observe.** Read what the pattern's Observe section lists. For each decision from `list`, gather what its 観察 field asks for. If any file the pattern generates already exists, read `references/merge.md` now.
2. **Plan.** Read `references/plan.md` and the pattern's Plan page section, then build the Plan page and iterate with the user until the plan is agreed.
3. **Generate and merge.** For each template file in the agreed plan, write the target file: keep the fixed text, and replace each decision block by what its 書き方 field says, using the agreed proposal. Write every generated file in the agreed document language. Write only what the agent reading the file uses for its task; leave out explanations it does not act on, such as why the file exists or which other tools read it. Defects of the product you find on the way (a bug, code that contradicts its documents) are not harness content: keep them out of the generated files and report them.
4. **Verify.** Run `leftovers` on the generated files; no decision block may remain. Check that every path in the AGENTS.md References table exists and that every symlink resolves. Report to the user the generated files, every remaining TODO, and the product defects you found.

## Pages

Build the Plan page with the `dev-process-kit` skill. Publish it through the environment's standard way of showing a page to the user (for example, an Artifact in Claude Code); without one, write a local HTML file and give the user its path. Ask the questions on the page, not in chat.
