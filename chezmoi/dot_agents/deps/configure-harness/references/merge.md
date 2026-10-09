# Merge

Bring the templates into a repository that already has some harness without losing what it has.

## Mapping

For each existing harness file, decide one of:

- **Merge into a template target**: the content belongs to a generated file (for example, commit rules in `CONTRIBUTING.md` → `docs/guidelines/commit.md`). Move the rules that are still valid, and replace the source with a path reference when other tools or people still read it.
- **Keep and reference**: the file has no template counterpart (an architecture document, a deploy runbook). Leave it and add a row to the AGENTS.md References table.
- **Replace with a reference**: a tool-specific instruction file (`CLAUDE.md`, `REVIEW.md`, `.github/copilot-instructions.md`) that duplicates guidelines. Make it a symlink to `AGENTS.md` or a short file that points to the canonical guideline, as `tool-links` decides.

Existing rules are evidence for decisions: offer them as the recommended option in the Grill rather than overwriting them with the template.

## Showing the plan

Before writing, show the user the mapping of every existing harness file and, for each target that already exists, the diff you will apply. Use the Grill page's main area when the Grill is still running; otherwise show it in the reply. Do not delete an existing file without the user's agreement.
