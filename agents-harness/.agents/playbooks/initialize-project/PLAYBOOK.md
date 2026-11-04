---
name: initialize-project
description: プロジェクトの初期構成をセットアップする
---

# Initialize project

Set up a new project from scratch using the recommended patterns in `~/.agents/references/shared/recommended-patterns/`. Read its `README.md` for the pattern index and template file conventions.

## Step 1: Gather Requirements

Ask the user to collect project configuration. Questions must be asked one at a time (max 4 options per question).

### Question 1: Visibility

> Public (include LICENSE) or Private?

### Question 2: Core Language

> Core language: TypeScript or other?

If TypeScript, continue. Otherwise, only `project-code/` setup applies — skip remaining questions and proceed to Step 2.

### Question 3: Package Structure (TypeScript only)

> Single package or Monorepo (workspace)?

### Question 4: Additional Tools (TypeScript only)

> Core libraries (TypeScript, oxlint, oxfmt, vitest, lefthook) are included by default.
> Select additional tools to set up:

Present the following as options (these correspond to patterns):

- hono (Backend API)
- tanstack-start (Frontend — TanStack Start + React + Router/Query; choose `prerender` or `spa` mode)
- cloudflare-workers (Cloudflare Workers deploy + asset serving)
- shadcn-ui (UI components)

### Question 5: TanStack Start Mode (only if `tanstack-start` selected)

> TanStack Start mode: `prerender` or `spa`?

- `prerender`: pre-render `/` and `/home`; `/` renders no UI and redirects to `/home` after hydration.
- `spa`: old TanStack Router SPA replacement; no pre-rendered pages.

For Cloudflare Workers Assets, both modes use `assets.notFoundHandling: 'single-page-application'`.

## Step 2: Orchestrate Setup via Subagents

Do not perform the setup directly in the main agent. The main agent is responsible for orchestration only:

1. Determine the required patterns and options from Step 1, including TanStack Start mode when applicable.
2. Dispatch subagents in the tier order below.
3. Pass each subagent the relevant pattern path(s) and explicit setup instructions.
4. Wait for each tier to complete before dispatching the next tier.
5. Review each subagent's report and resolve coordination issues before proceeding.

Instruct each subagent to report every point where the pattern did not apply as written: missing or misplaced template files, changed commands or package APIs, deprecated tools, and fixes needed to make the result pass verification.

For each pattern, instruct the subagent to read its `index.md` for detailed instructions, then copy and customize template files. Provide the path explicitly, e.g. `~/.agents/references/shared/recommended-patterns/project-code/index.md`. Pass selected options explicitly (for example `tanstack-start mode=prerender`).

### Tier 1: Platform

Foundation that all other tiers depend on.

| Pattern | Condition |
|---------|-----------|
| `project-code/` | Always |
| `typescript-package/` | TypeScript selected |
| `workspace/` | Monorepo selected |

`project-code/` is always required regardless of language or structure.

### Tier 2: Application

Framework-level setup. Depends on Tier 1 being complete.

| Pattern | Condition |
|---------|-----------|
| `hono/` | Selected in Step 1 |
| `tanstack-start/` | Selected in Step 1 |

### Tier 3: Tool

Additional tooling layered on top of application setup.

| Pattern | Condition |
|---------|-----------|
| `shadcn-ui/` | Selected in Step 1 |
| `cloudflare-workers/` | Selected in Step 1 |

**Location rules**:
- Single package: All configs at project root, source in `src/`
- Workspace: Shared configs (oxc, lefthook, turbo) at root, app-specific configs in `apps/*/` or `packages/*/`

## Step 3: Verify

Verification may be delegated to a subagent as well. Pass the subagent the project path, the selected patterns, and the expected verification commands.

Run the project's build, lint, and test commands in sequence. Fix any failures before proceeding to the next.

For TypeScript projects, this typically includes:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm build       # skip for library-only projects
```

Adapt commands to the actual project setup.

## Step 4: Update the Patterns

Fix the patterns under `~/.agents/references/shared/recommended-patterns/` for every deviation reported in Step 2 or found in Step 3, so the next run applies cleanly. Update both `template/` and `index.md`, and keep the project-specific customizations out of them.
