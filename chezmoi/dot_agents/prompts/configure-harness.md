---
name: configure-harness
description: Set up or extend a repository's coding-agent harness, proposing the project-specific points that need the user's judgment on a Plan page.
argument-hint: "[core|auto-pilot|deterministic]"
disable-model-invocation: true
user-invocable: true
---

# Configure Harness

The templates, setups, references, and scripts live in `~/.agents/deps/configure-harness/`; the `templates/`, `setups/`, `references/`, and `scripts/` paths below are relative to it.

## Setup

The setup to bring in is `$ARGUMENTS`, or `core` when it is empty: one of `core` (the base harness), `auto-pilot` (an agent that leads the project), and `deterministic` (checks that do not depend on judgment). Read `setups/<setup>.md` before anything else. It says what must exist first, what to observe, when to propose each optional unit, what the Plan page always shows, and what to do beyond the steps below. Where it differs from this file, follow it.

Bring the harness structure in `templates/<setup>/` into the target repository. Fixed rules in the templates are copied as they are; every project-specific point is a decision block, proposed from what the repository shows, and then replaced by what it says to write. The proposals that need the user's intent or can swing are reviewed on the Plan page.

## Templates

`templates/<setup>/` is the tree generated in the target repository, at the same paths. Always generate a template file unless it carries the `.optional` marker:

- A file named `<name>.optional.<ext>` is an optional unit, generated as `<name>.<ext>`.
- A directory named `<name>.optional/` is an optional unit as a whole, generated as `<name>/`.

The setup file says when to propose each optional unit.

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

Run with Node.js 24 or later from `~/.agents/deps/configure-harness/`.

- `node scripts/decisions.ts files <setup>`: every template file of the setup as JSON, with its target path and the optional unit it belongs to.
- `node scripts/decisions.ts list <setup>`: the setup's decision blocks as JSON, with template and target paths and optional unit.
- `node scripts/decisions.ts leftovers <path...>`: unresolved decision blocks (exit 1) and TODO comments in generated files.
- `node scripts/decisions.ts check`: validate the templates. Run it after changing a template.

## Steps

1. **Observe.** Check the setup's prerequisites, then read what its Observe section lists. For each decision from `list <setup>`, gather what its 観察 field asks for. If any file the setup generates already exists, read `references/merge.md` now.
2. **Plan.** Read `references/plan.md` and the setup's Plan page section, then build the Plan page and iterate with the user until the plan is agreed.
3. **Generate and merge.** Do what the setup's Generate section says, and for each template file in the agreed plan, write the target file: keep the fixed text, and replace each decision block by what its 書き方 field says, using the agreed proposal. Write every generated file in the agreed document language. Write only what the agent reading the file uses for its task; leave out explanations it does not act on, such as why the file exists or which other tools read it. Defects of the product you find on the way (a bug, code that contradicts its documents) are not harness content: keep them out of the generated files and report them.
4. **Verify.** Run `leftovers` on the generated files; no decision block may remain. Check that every path in the AGENTS.md References table exists and that every symlink resolves. Run the setup's Verify section, if it has one. Report to the user the generated files, every remaining TODO, the product defects you found, and what the setup's Report section adds.

## Pages

Build the Plan page with the `dev-process-kit` skill. Publish it through the environment's standard way of showing a page to the user (for example, an Artifact in Claude Code); without one, write a local HTML file and give the user its path. Ask the questions on the page, not in chat.
