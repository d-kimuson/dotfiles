# Plan

Propose the setup on one Plan page, built with the `grill` template of `dev-process-kit` (title it `Visually Plan: <repository>`, and add `(<setup>)` for a setup other than core). The page is a plan to review, not a questionnaire and not an inventory: decide every point the repository can support yourself, and put on the page only what the user has to look at.

## What goes on the page

Make a proposal for every decision from `list <setup>` and every optional unit from `files <setup>`, but show only:

- Proposals that need the user's intent: what the repository cannot show, or a proposal with no evidence (propose the common default and mark it as unsupported).
- Proposals where the judgment can swing: there is another option with a real trade-off, or the observations conflict.
- What the setup file says the page always shows.
- The resulting harness tree, and changes to what exists: existing files removed or moved, and existing rules that change.

To tell whether a proposal can swing, ask whether it changes how the work is done: it adds or drops a practice (writing ADRs, designing features in a Design Doc first, proving a spec), or changes who does what. A proposal that only records what the repository already does does not swing, even when it is written for the first time.

Apply everything else without showing it. Proposals that follow directly from the repository (the overview, the directory structure, the libraries in the manifest, the commit format already in use) stay out of the page; the user sees them in the generated files. Do not list what will not be generated, what stays as it is, or decisions skipped because their subject does not exist.

Every element on the page must be something the user would act on. When in doubt, leave it out: a long page makes the user skip the part that matters.

## Questions

Ask a question only for a fact the repository cannot show (the purpose of a new product, where the user wants to be asked) or for observations that conflict, besides the questions the setup file always asks. Put the options you see, mark the recommended one with `（推奨）`, and say why in one sentence. Do not turn a proposal into a question: a proposal without evidence is still a proposal, shown as unsupported, not asked.

## Main area

Show the plan visually, with prose only for what a picture cannot say:

- What the setup file says to show first.
- The harness tree after generation, as one tree with a short comment per entry that says what it is for (`.agents/   # skills と troubleshots`), not its status. Mark added and moved entries with a symbol, and list removed files under it with where their content goes (`references/merge.md`). Include an optional unit only when it is proposed, and never mark one as undecided: an optional unit that can swing is a shown proposal. Do not list the product's own source directories. Invite the user to ask for changes to the tree or ask about it.
- The shown proposals, each with its gist and the evidence in one line, labeled `P1`, `P2`, … so the user can name one in a review note.

Tie each question to the proposal it concerns with a badge.

## Rounds

Apply the user's answers and review notes to the proposals. Publish another round only when a change needs the user to look again or an answer raises a new question; move the answered questions into `history`. When a round comes back with no objection, the plan is agreed.
