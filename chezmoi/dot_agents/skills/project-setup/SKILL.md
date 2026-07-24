---
name: project-setup
description: 'プロジェクトの初期化・設定に関するナレッジ'
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(pnpm:*, git:*, curl:*, mkdir:*, ls:*, npx:*, node:*, chmod:*, cp:*, mv:*, rm:*, rg:*)
---

Knowledge base for project setup, configuration, and conventions.

Provides reference documents for tooling, frameworks, and workflows. Read the relevant `index.md` for each topic, then copy and customize template files as documented.

## Workflows

If the user's request matches a workflow, read the workflow file and follow its procedure.

All paths are relative to this skill's directory (`references/`).

| Workflow | Trigger |
|----------|---------|
| `workflows/init.md` | New project initialization from scratch |

<reference_index>

## Reference Index

All paths are relative to this skill's directory (`references/`).

| Reference | Description |
|-----------|-------------|
| `core/` | Nix flakes, direnv, GitHub Actions Nix setup, LICENSE, .gitignore — cross-language project foundation |
| `typescript-package/` | npm + TypeScript + oxc + vitest + dev-tools + CI — all-in-one for TS projects |
| `workspace/` | Monorepo — `pnpm-workspace.yaml`, `turbo.json`, root `tsconfig.json` |
| `hono/` | Backend API — Hono app/context, route composition, workflow/service/domain structure, typed client |
| `tanstack-start/` | Frontend — TanStack Start with selectable `prerender` (`/` + `/home`) or `spa` mode |
| `shadcn-ui/` | UI components — Tailwind + shadcn init, `components.json` for shared packages |
| `cloudflare-workers/` | Cloudflare Workers deploy — `wrangler.jsonc`, `worker.ts`, D1 migration, manual deploy scripts |
| `agent-harness/` | CLAUDE.md/AGENTS.md, architecture/process/QA docs, project coding-guideline skill |

</reference_index>
