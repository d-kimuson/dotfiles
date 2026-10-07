# Delegation Poker

Decide what the agent may do without an instruction, with the `delegation-poker` template of `dev-process-kit`, and expand the result into `docs/guidelines/delegate.md`.

## Board

Before building the page, ask the user whether to use `strict` or `lax` mode, as the template requires.

Use `あなた` and the agent's name as `parties`. Add yourself as a player and play a card on every area, with a `reason` that states what you can verify and what can go wrong.

Pick the decision areas from these candidates that the repository actually has, and name the concrete commands or targets in each `description`:

| Area | Typical operations |
| --- | --- |
| コミット | committing finished work |
| ブランチ | creating a branch, choosing its name and base |
| push | pushing to the remote, including what a push triggers (preview deploys, CI) |
| PR の作成 | opening a pull request |
| マージ | merging after CI and review pass |
| 依存の追加・更新 | adding a package, a major version upgrade |
| 本番の操作 | deploying to production, production data, secrets |
| 履歴の書き換え | force push, rebase or amend of pushed commits, deleting remote branches |
| 共有リソースの作成・削除 | cloud resources, databases, external service settings |
| 外部への送信 | posting to issues, chat, or other people |

Add areas the repository needs (for example, database migrations). Drop an area only when it cannot happen in this repository; keep the ones that are planned but not set up yet (a new repository without a remote still gets push and PR), and name the planned target in the `description`.

## Expanding into delegate.md

Fold each agreed level into an instruction for the agent. Do not write the levels or the board itself.

| Agreed level | Section in `delegate.md` |
| --- | --- |
| 5 Advise, 6 Inquire, 7 Delegate | `### やる` |
| 3 Consult, 4 Agree | `### 確認してからやる`: propose with the reason and wait for approval |
| 1 Tell, 2 Sell | `### やらない`: only when explicitly instructed |

For 6 Inquire, add that the agent reports what it did. Write each item as the operation with its concrete commands or targets and the guideline that governs it, following the `delegation-defaults` decision block. Write the section headings in the agreed document language.
