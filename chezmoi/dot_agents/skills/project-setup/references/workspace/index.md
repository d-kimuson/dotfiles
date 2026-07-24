# Workspace (Monorepo) Setup

Extends the root `pnpm-workspace.yaml` with workspace package paths and adds Turborepo for task orchestration.

## Setup Steps

1. Add `packages` field to root `pnpm-workspace.yaml` (copy template content and merge with existing)
2. Install turbo: `pnpm add -D -w turbo`
3. Copy `turbo.json` to project root — customize `outputs` in `build` task if needed
4. Copy `tsconfig.json` to project root — add project references for each workspace package

## Template Files

| File | Customize |
|------|-----------|
| `pnpm-workspace.yaml` | Merge `packages` field into existing root config |
| `turbo.json` | `build.outputs` if using non-standard output dirs |
| `tsconfig.json` | `references` array — list all workspace package tsconfig paths |
