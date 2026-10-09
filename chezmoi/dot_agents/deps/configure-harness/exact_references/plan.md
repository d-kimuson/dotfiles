# Plan

Propose the harness on one Plan page, built with the `grill` template of `dev-process-kit` (title it `Visually Plan: <repository>`). The page is a plan to review, not a questionnaire and not an inventory: decide every point the repository can support yourself, and put on the page only what the user has to look at.

## What goes on the page

Make a proposal for every decision from `list` and every optional unit from `files`, but show only:

- Proposals that need the user's intent: what the repository cannot show, or a proposal with no evidence (propose the common default and mark it as unsupported).
- Proposals where the judgment can swing: there is another option with a real trade-off, or the observations conflict.
- The Definition of Done, always, as a question.
- The criteria proposed in `human-check-criteria`, always: they set what the user checks by hand, so the user has to agree to them.
- The resulting harness tree, and changes to what exists: existing files removed or moved, and existing rules that change.

To tell whether a proposal can swing, ask whether it changes how the work is done: it adds or drops a practice (writing ADRs, designing features in a Design Doc first), or changes who does what. A proposal that only records what the repository already does does not swing, even when it is written for the first time.

Apply everything else without showing it. Proposals that follow directly from the repository (the overview, the directory structure, the libraries in the manifest, the commit format already in use) stay out of the page; the user sees them in the generated files. Do not list what will not be generated, what stays as it is, or decisions skipped because their subject does not exist.

Every element on the page must be something the user would act on. When in doubt, leave it out: a long page makes the user skip the part that matters.

| Optional unit | Propose it when |
| --- | --- |
| `docs/CONTEXT.md` / `docs/CONTEXT-MAP.md` | Always exactly one, as `context-layout` proposes: `docs/CONTEXT.md` for a small single-domain repository, otherwise `docs/CONTEXT-MAP.md` |
| `docs/guidelines/writing/adr.md` | The repository already records decisions, or it has design choices later readers will ask about (several components, external integrations) |
| `docs/guidelines/writing/design-doc.md` | The repository already has design documents (RFC, spec), or features are designed before they are built |

Show `context-layout` only when it proposes `docs/CONTEXT-MAP.md` or the evidence is mixed.

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

The Definition of Done is the core of how the user delegates, so always ask it as the first question, even when the history is clear. Offer the five levels as options, mark the level the history points to with `（推奨）`, and put the evidence and the proposed checks in the description. Without a remote or a pull request history, recommend nothing from history and ask the checks in a second question.

## Questions

Besides the Definition of Done, ask a question only for a fact the repository cannot show (the purpose of a new product) or for observations that conflict. Put the options you see, mark the recommended one with `（推奨）`, and say why in one sentence. Do not turn a proposal into a question: a proposal without evidence is still a proposal, shown as unsupported, not asked.

## Main area

Show the plan visually, with prose only for what a picture cannot say:

- The Definition of Done as the five levels (EditOnly → Main Push → Draft PR → Open PR → Merge PR) with the proposed level highlighted, the checks, and the evidence next to them, badged with its question.
- The harness tree after generation, as one tree with a short comment per entry that says what it is for (`.agents/   # skills と troubleshots`), not its status. Mark added and moved entries with a symbol, and list removed files under it with where their content goes (`references/merge.md`). Include an optional unit only when it is proposed, and never mark one as undecided: an optional unit that can swing is a shown proposal. Do not list the product's own source directories. Invite the user to ask for changes to the tree or ask about it.
- With `docs/CONTEXT-MAP.md`, the proposed Contexts and the dependencies between them as a diagram.
- The shown proposals, each with its gist and the evidence in one line, labeled `P1`, `P2`, … so the user can name one in a review note.

Tie each question to the proposal it concerns with a badge.

## Rounds

Apply the user's answers and review notes to the proposals. Publish another round only when a change needs the user to look again or an answer raises a new question; move the answered questions into `history`. When a round comes back with no objection, the plan is agreed.
