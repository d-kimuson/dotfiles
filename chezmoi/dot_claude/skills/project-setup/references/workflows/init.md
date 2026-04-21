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
- tanstack-spa (Frontend SPA)
- shadcn-ui (UI components)

If more tool references are added in the future, split into multiple questions (max 4 options each).

## Step 2: Setup Sequence

Follow this order — each tier depends on the previous ones.

For each reference: read its `index.md` for detailed instructions, then copy and customize template files.

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
| `tanstack-spa/` | Selected in Step 1 |

### Tier 3: Tool

Additional tooling layered on top of application setup.

| Reference | Condition |
|-----------|-----------|
| `shadcn-ui/` | Selected in Step 1 |

**Location rules**:
- Single package: All configs at project root, source in `src/`
- Workspace: Shared configs (oxc, lefthook, turbo) at root, app-specific configs in `apps/*/` or `packages/*/`

## Step 3: Verify

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

Read `agent-harness/index.md` and follow its procedure to generate CLAUDE.md/AGENTS.md and convention docs.
