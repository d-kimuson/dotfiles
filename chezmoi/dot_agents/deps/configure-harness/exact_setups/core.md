# Setup: core

The base harness: `AGENTS.md`, `REVIEW.md`, `docs/guidelines/`, `.agents/troubleshots/`. The other setups build on it.

## Observe

Read the existing harness (`AGENTS.md`, `CLAUDE.md`, `docs/`, `.agents/`, `.claude/`, `.github/`, review tool configs, how the product starts locally, where tasks are tracked and where the team talks), `git log`, the pull request history (`gh`), manifests, CI, and the scripts.

## Optional units

| Optional unit | Propose it when |
| --- | --- |
| `docs/CONTEXT.md` / `docs/CONTEXT-MAP.md` | Always exactly one, as `context-layout` proposes: `docs/CONTEXT.md` for a small single-domain repository, otherwise `docs/CONTEXT-MAP.md` |
| `docs/guidelines/writing/adr.md` | The repository already records decisions, or it has design choices later readers will ask about (several components, external integrations) |
| `docs/guidelines/writing/design-doc.md` | The repository already has design documents (RFC, spec), or features are designed before they are built |
| `docs/guidelines/backlog.md` | The repository keeps its tasks in a tracker (issues, Projects, Linear) |
| `docs/guidelines/team-channel.md` | The user wants questions and reports in a chat tool |

Show `context-layout` only when it proposes `docs/CONTEXT-MAP.md` or the evidence is mixed.

## Plan page

Always show:

- The Definition of Done, as the first question, even when the history is clear (below).
- The criteria proposed in `human-check-criteria`: they set what the user checks by hand, so the user has to agree to them.

Show first in the main area the Definition of Done as the five levels (EditOnly → Main Push → Draft PR → Open PR → Merge PR) with the proposed level highlighted, the checks, and the evidence next to them, badged with its question. With `docs/CONTEXT-MAP.md`, also show the proposed Contexts and the dependencies between them as a diagram.

## Definition of Done

Propose the `definition-of-done` decision from the history:

| Observation | Points to |
| --- | --- |
| Changes land on `main` without pull requests (`git log --first-parent main`) | Main Push |
| Pull requests start as drafts | Draft PR |
| The user's own pull requests are merged by someone else | Open PR |
| The user's own pull requests are merged by the user | Merge PR |
| CI runs on pushes or pull requests (`.github/workflows/`, `gh pr checks`) | CI Pass |
| AI reviewers (Copilot, Claude, CodeRabbit, Codex) comment on pull requests (`gh pr view --json reviews,comments`) | Review by that reviewer; otherwise Review by a SubAgent |
| The product can be started locally and operated (`local-startup`, `operate`) | QA Check |

Judge the merge levels by the pull requests the user authored (`gh pr list --author @me --state merged --json mergedBy`). Pull requests from bots and other contributors show how the user reviews others, not how the user's own work lands, so leave them out.

The Definition of Done is the core of how the user delegates. Offer the five levels as options, mark the level the history points to with `（推奨）`, and put the evidence and the proposed checks in the description. Without a remote or a pull request history, recommend nothing from history and ask the checks in a second question.

## Report

Also tell the user that `/configure-harness auto-pilot` adds an agent that leads the project and `/configure-harness deterministic` adds deterministic checks, in one line each, only when the observations suggest them (a tracker with many open tasks; a quality-matrix with rows nothing catches reliably).
