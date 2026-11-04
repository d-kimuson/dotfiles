# Setup: auto-pilot

An agent that leads the project until the user freezes it: `docs/guidelines/auto-pilot.md` and `.agents/auto-pilot/`. It changes who decides what to work on, so the whole setup is a proposal the user reviews.

## Prerequisites

- The core harness exists (`AGENTS.md`, `docs/guidelines/delegate.md`). If it does not, tell the user to run `/configure-harness` first and stop.
- auto-pilot depends on four core optional units: `docs/guidelines/backlog.md`, `docs/guidelines/team-channel.md`, `docs/guidelines/writing/adr.md`, and `docs/guidelines/writing/design-doc.md`. Generate the missing ones from `templates/core/` as part of this setup, with their decisions from `list core`, and add their rows to the AGENTS.md References table and the `harness.md` placement table.
- The clean-up of every turn calls the `compact` tool (self-compact). Check that the agent the user runs auto-pilot with has it; if not, tell the user, since auto-pilot cannot move to the next turn without it.
- `.agents/auto-pilot/scripts/maintenance.ts` needs Node.js 24.2 or later. If the repository pins an older Node.js, say so on the Plan page.

## Observe

- Where tasks are tracked, their states, priority, and blocking (`backlog`, `backlog-states`, `ready-definition`).
- Whether the repository is public (`gh repo view --json visibility`; without a remote, treat it as private): the security maintenance tasks keep findings out of public issues.
- What each maintenance task below needs: a product that starts locally, a UI, dependencies, CI, analytics, production monitoring.
- The Definition of Done in `docs/guidelines/delegate.md`.

## Maintenance tasks

Each task is an optional unit `.agents/auto-pilot/maintenance-tasks/<name>/`. Propose the tasks the repository supports with the default trigger, and write the agreed triggers into `maintenance-tasks/manifest.json` (`{"tasks": {"<name>": {"every": "7d"}}}`) in the order of this table: auto-pilot runs the due tasks in that order, so problems in production come first and dead code is removed before it is updated or checked.

| Task | Propose it when | Default trigger |
| --- | --- | --- |
| `observability-triage` | The product runs in production with monitoring (errors, logs, metrics) | `every: 1d` |
| `analytics-triage` | The user names an analytics source (GA, GSC, product analytics) | `every: 7d` |
| `dead-code-removal` | The repository has code | `afterCommits: 100` |
| `dependency-update` | A manifest has dependencies | `every: 7d` |
| `license-check` | The product ships or serves its dependencies | `every: 30d` |
| `security-review` | The repository has code | `every: 7d`, `afterCommits: 50` |
| `attack-simulation` | The product starts locally and has an attack surface (HTTP endpoints, authentication, file uploads) | `every: 14d` |
| `chaos-ui` | The product has a UI that can be operated locally | `every: 7d` |
| `ci-performance` | CI runs on pushes or pull requests, and its run history is readable (`gh run list`) | `every: 30d` |

## Plan page

Always show:

- auto-pilot itself as the first proposal: that it picks and orders the work, delegates implementation and design to Independent Agents, asks the user only for decisions, and may commit and push fixes to its own mechanism to main. Show how to start it: `/goal docs/guidelines/auto-pilot.md に従い、このプロジェクトが凍結されるまでこのプロジェクトの進行をリードすること`.
- `team-channel`: where the user wants questions is not in the repository.
- The maintenance tasks as one proposal: the proposed tasks with their triggers, and the ones left out with the reason. The user agrees to every task auto-pilot runs.
- `backlog` and `backlog-states` when the tracker or its states are unclear.

Show `independent-agent` only when the user names a way to start Independent Agents; otherwise apply the default. Independent Agents work in their own worktree, so when the Definition of Done is EditOnly, ask how their changes land.

## Generate

- Add to the AGENTS.md References table the row 「プロジェクトの進行をリードする (auto-pilot として起動されたとき)」 → `docs/guidelines/auto-pilot.md`.
- Add to the placement table of `docs/guidelines/harness.md` the row 「auto-pilot の状態・定期タスク・ワークアラウンド」 → `.agents/auto-pilot/` (`docs/guidelines/auto-pilot.md`).

## Verify

Run `node .agents/auto-pilot/scripts/maintenance.ts due` from the repository root: it must list every chosen task as never run. Give the user the command that starts auto-pilot.
