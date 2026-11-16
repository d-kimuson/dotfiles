# Recommended Patterns

Reference documents and template files for project tooling, frameworks, and conventions. Read the relevant `index.md` for each pattern, then copy and customize template files as documented.

Each pattern's `template/` mirrors a single-package project: `template/<path>` is copied to `<path>` in the project, dotfiles included. `index.md` refers to template files by that path. When copying a directory, copy its contents with a trailing `/.` (e.g. `mkdir -p src/web && cp -R <pattern>/template/src/web/. src/web/`); `cp -R template/src/web/ src/web/` can nest into `src/web/web/` depending on the `cp` implementation and whether the destination exists. In a workspace, place package-level files under `apps/<name>/` or `packages/<name>/`.

| Pattern | Description |
|---------|-------------|
| `project-code/` | Nix flakes, direnv, dotenv (`.env` / `.env.secret` / `.env.overrides`), GitHub Actions Nix setup, LICENSE, .gitignore — cross-language project foundation |
| `typescript-package/` | npm + TypeScript + oxc + vitest + dev-tools + CI — all-in-one for TS projects |
| `workspace/` | Monorepo — `pnpm-workspace.yaml`, `turbo.json`, root `tsconfig.json` |
| `hono/` | Backend API — Hono app/context, route composition, workflow/service/domain structure, typed client |
| `tanstack-start/` | Frontend — TanStack Start with selectable `prerender` (`/` + `/home`) or `spa` mode |
| `shadcn-ui/` | UI components — Tailwind + shadcn init, `components.json` for shared packages |
| `cloudflare-workers/` | Cloudflare Workers deploy — `cf` CLI + `cloudflare.config.ts`, `worker.ts`, D1 + Kysely + Atlas migrations, manual deploy scripts |
