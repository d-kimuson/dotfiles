# Project Initialization Workflow

Workflow for setting up a new project from scratch.

## Step 1: Gather Requirements

Use AskUserQuestion to collect project configuration. Questions must be asked one at a time (max 4 options per question).

### Question 1: Visibility

> Public (include LICENSE) or Private?

### Question 2: Core Language

> Core language: TypeScript or other?

If TypeScript, continue. Otherwise, only `core/` setup applies — skip remaining questions and proceed to Step 2.

### Question 3: Package Structure (TypeScript only)

> Single package or Monorepo (workspace)?

### Question 4: Additional Tools (TypeScript only)

> Core libraries (TypeScript, oxlint, oxfmt, vitest, lefthook, gatecheck) are included by default.
> Select additional tools to set up:

Present the following as options (these correspond to references):

- hono (Backend API)
- tanstack-start (Frontend — TanStack Start + React + Router/Query; choose `prerender` or `spa` mode)
- cloudflare-workers (Cloudflare Workers deploy + asset serving)
- shadcn-ui (UI components)

If more tool references are added in the future, split into multiple questions (max 4 options each).

### Question 5: TanStack Start Mode (only if `tanstack-start` selected)

> TanStack Start mode: `prerender` or `spa`?

- `prerender`: pre-render `/` and `/home`; `/` renders no UI and redirects to `/home` after hydration.
- `spa`: old TanStack Router SPA replacement; no pre-rendered pages.

For Cloudflare Workers Assets, both modes use `not_found_handling: "single-page-application"`.

### Question 6: Auth and E2E Bypass (only if the app has frontend + backend or user requests auth)

> Does this application need user authentication?

If yes, require the setup to include an E2E/QA auth bypass such as `DISABLE_AUTH=true` so agents can verify behavior without external OAuth login. If no, do not add auth-specific files or environment variables.

## Step 2: Orchestrate Setup via Subagents

Do not perform the setup directly in the main agent. The main agent is responsible for orchestration only:

1. Determine the required references and options from Step 1, including TanStack Start mode and auth bypass requirement when applicable.
2. Dispatch subagents in the tier order below.
3. Pass each subagent the relevant reference file path(s) and explicit setup instructions.
4. Wait for each tier to complete before dispatching the next tier.
5. Review each subagent's report and resolve coordination issues before proceeding.

For each reference, instruct the subagent to read its `index.md` for detailed instructions, then copy and customize template files. Provide the reference path explicitly, e.g. `references/core/index.md` or the absolute path to that file. Pass selected options explicitly (for example `tanstack-start mode=prerender` and `auth bypass required=true`).

### Tier 1: Platform

Foundation that all other tiers depend on.

| Reference | Condition |
|-----------|-----------|
| `core/` | Always |
| `typescript-package/` | TypeScript selected |
| `workspace/` | Monorepo selected |

`core/` is always required regardless of language or structure.

### Tier 2: Application

Framework-level setup. Depends on Tier 1 being complete.

| Reference | Condition |
|-----------|-----------|
| `hono/` | Selected in Step 1 |
| `tanstack-start/` | Selected in Step 1 |

### Tier 3: Tool

Additional tooling layered on top of application setup.

| Reference | Condition |
|-----------|-----------|
| `shadcn-ui/` | Selected in Step 1 |
| `cloudflare-workers/` | Selected in Step 1 |

**Location rules**:
- Single package: All configs at project root, source in `src/`
- Workspace: Shared configs (oxc, lefthook, turbo) at root, app-specific configs in `apps/*/` or `packages/*/`

## Step 3: Verify

Verification may be delegated to a subagent as well. Pass the subagent the project path, the selected setup references, and the expected verification commands.

Run the project's build, lint, and test commands in sequence. Fix any failures before proceeding to the next.

For TypeScript projects, this typically includes:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm build       # skip for library-only projects
```

Adapt commands to the actual project setup.

## Step 4: Agent Harness

Delegate this step to a subagent. Pass `references/agent-harness/index.md` (or its absolute path), the project path, and the project configuration gathered in Step 1.

Instruct the subagent to read `agent-harness/index.md` and follow its procedure to generate CLAUDE.md/AGENTS.md and convention docs.
