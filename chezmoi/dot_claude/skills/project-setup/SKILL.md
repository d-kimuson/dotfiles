---
name: project-setup
description: 'プロジェクトの初期化・設定に関するナレッジ'
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(pnpm:*, git:*, curl:*, mkdir:*, ls:*, npx:*)
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
| `hono/` | Backend API — `app.ts`, `routes.ts`, `server.ts`, `main.ts`, `client.ts` + hono-rpc-msw-adapter |
| `tanstack-spa/` | Frontend SPA — `vite.config.ts`, `index.html`, `main.tsx`, `__root.tsx`, query client |
| `shadcn-ui/` | UI components — Tailwind + shadcn init, `components.json` for shared packages |
| `agent-harness/` | CLAUDE.md/AGENTS.md, coding guideline/process, conventions (commit, branch, E2E testing) |

</reference_index>
