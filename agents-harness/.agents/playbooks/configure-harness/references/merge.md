# Merge

Bring the templates into a repository that already has some harness without losing what it has.

## Mapping

For each existing harness file, decide one of:

- **Merge into a template target**: the content belongs to a generated file (for example, commit rules in `CONTRIBUTING.md` → `docs/guidelines/commit.md`). Move the rules that are still valid, and replace the source with a path reference when other tools or people still read it.
- **Keep and reference**: the file has no template counterpart (an architecture document, a deploy runbook). Leave it and add a row to the AGENTS.md References table.
- **Merge into `REVIEW.md`**: review instructions in an existing `REVIEW.md`, `.github/copilot-instructions.md`, or a review tool config (`.coderabbit.yaml`), as `review-patterns` decides. Move what is not about review into `AGENTS.md` or a guideline, then delete `.github/copilot-instructions.md`.
- **Remove**: a file whose job the harness now does. A `CLAUDE.md` (a copy of or a symlink to `AGENTS.md`): Claude Code reads `AGENTS.md`, so move what only `CLAUDE.md` has into `AGENTS.md` or a guideline. A review skill or command that only points to review instructions: `REVIEW.md` and the `Code Review Rules` section of `AGENTS.md` replace it.

Existing rules are evidence for decisions: propose them on the Plan page rather than overwriting them with the template.

## Showing the plan

Show on the Plan page the existing files that are removed or moved and where their content goes, and the existing rules that change. Leave out files that are only merged without changing a rule. Do not delete an existing file without the user's agreement.
