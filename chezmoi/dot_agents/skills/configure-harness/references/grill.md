# Grill

Settle the structure and the project's conventions with the `grill` template of `dev-process-kit`.

## Questions

- First round: the document language (`document-language`), the optional features (one multi-choice question listing each feature with what it adds), and the AI review tools and coding agents in use (feeds the `tool-links` and `codex-review-section` decisions and which files of the `review-tools` feature to generate). These change which decisions apply.
- Later rounds: the remaining decisions of `core`, `stack`, and the chosen `optional/<feature>`. Skip `delegation-defaults`; Delegation Poker decides it.
- Write each question from the decision's 決めること, specific to this repository. One decision may become several questions, and closely related decisions may share one.
- Put what you observed as options. Mark the option the repository already follows, or the one you recommend, with `（推奨）` and say why in the description in one sentence. When nothing in the repository supports a recommendation, say so and recommend the common default. Every decision is confirmed by the user, even when the observation looks conclusive.
- Do not ask about a decision whose subject does not exist in the repository and is not planned (for example, `libraries` in a repository without dependencies). List it on the page as omitted, so the user can object. Anything the repository merely has no evidence for yet, such as the overview of a new repository, is still asked.

## Main area

Show what the user needs to answer: the target tree of files to generate with their category, the existing files they will merge into, and an excerpt of the observed evidence (such as recent commit messages) next to the questions it supports. Tie questions to elements with badges. When `bounded-context` is chosen, draw the proposed Contexts and the dependencies between them as a diagram for the `bounded-contexts` decision.

## Rounds

Move each answered round into `history` and add the next round's questions. Ask follow-up questions where an answer is free text, ambiguous, or conflicts with the repository. Stop when every applicable decision has an answer.
