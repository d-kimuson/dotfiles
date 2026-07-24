# Cloudflare Workers Setup

Deploy a Cloudflare Workers application with static asset serving, selective worker routing, and optional D1/Drizzle migrations.

## Architecture

- Static assets (HTML/JS/CSS) are served directly by Cloudflare Workers Assets.
- Only specific paths (e.g. `/api/*`) are routed to the Worker via `run_worker_first`.
- The Worker itself double-checks the path and returns 404 for non-matching Worker paths.
- For frontend apps, use `assets.not_found_handling: "single-page-application"` for both SPA and pre-rendered TanStack Start apps. Do not use `404-page` fallback for SPA-routed pages because crawlers can treat fallback pages as not found.

## Setup Sequence

### 1. Install Dependencies

```bash
pnpm add -D wrangler @cloudflare/vite-plugin
```

When using D1 + Drizzle:

```bash
pnpm add drizzle-orm
pnpm add -D drizzle-kit
```

### 2. Wrangler Configuration

Copy `wrangler.jsonc` to project root and customize:

- `name`: project name
- `main`: worker entrypoint path (e.g. `src/server/worker.ts`)
- `assets.directory`: build output directory (e.g. `./dist/client`)
- `assets.not_found_handling`: keep `single-page-application` for frontend apps
- `assets.run_worker_first`: glob patterns for paths routed to the Worker (e.g. `["/api/*"]`)
- `vars`: non-secret environment variables (safe to commit)
- `env.prod.vars`: production-specific overrides
- `d1_databases`: remove if D1 is not used; otherwise set `database_id` after creating DBs

Do not include app-specific OAuth redirect vars unless the selected auth library requires them.

### 3. Worker Entrypoint

Copy `worker.ts` to the worker entrypoint path. Customize:

- Import path for Hono app and routes
- Path prefix check (default: `/api/`)

### 4. D1 + Drizzle Migrations (optional)

If using D1 with Drizzle:

1. Copy `drizzle.config.ts` to project root and update `schema` path.
2. Copy `prepare-d1-migrations.ts` and `verify-migrations.ts` to `src/scripts/`.
3. Create D1 databases:

```bash
pnpm wrangler d1 create "<project-name>-dev"
pnpm wrangler d1 create "<project-name>-prod"
```

4. Put the resulting `database_id` values into `wrangler.jsonc`.
5. Add scripts:

```json
{
  "scripts": {
    "migrate:generate": "drizzle-kit generate && node ./src/scripts/prepare-d1-migrations.ts",
    "migrate:verify": "node ./src/scripts/verify-migrations.ts",
    "migrate:local": "wrangler d1 migrations apply <project-name>-dev --local",
    "migrate:dev": "wrangler d1 migrations apply <project-name>-dev --remote",
    "migrate:prod": "wrangler d1 migrations apply <project-name>-prod --remote"
  }
}
```

`prepare-d1-migrations.ts` converts Drizzle's directory-shaped migrations into Wrangler D1's flat migration file layout by creating symlinks under `drizzle/d1-migrations`.

### 5. Environment Management

**Non-secret vars**: Define in `wrangler.jsonc` under `vars` (dev) and `env.prod.vars` (prod).

**Secrets**: Set via Wrangler CLI, never commit to source:

```bash
pnpm wrangler secret put SECRET_NAME
pnpm wrangler secret put SECRET_NAME --env prod
```

**Type generation**: Generate TypeScript types from bindings:

```bash
pnpm wrangler types ./src/server/worker-configuration.d.ts
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "generate:wrangler": "pnpm wrangler types ./src/server/worker-configuration.d.ts"
  }
}
```

### 6. Deploy Scripts

Copy scripts:

- `manual-deploy.sh` → `scripts/manual-deploy.sh`
- `cf-deploy.sh` → `scripts/cf-deploy.sh`

Make them executable:

```bash
chmod +x scripts/manual-deploy.sh scripts/cf-deploy.sh
```

Add deploy scripts:

```json
{
  "scripts": {
    "deploy:remote": "wrangler deploy --minify",
    "deploy:preview": "wrangler versions upload --minify"
  }
}
```

`manual-deploy.sh` builds with `CLOUDFLARE_ENV` and delegates to `cf-deploy.sh`. `cf-deploy.sh` deploys an already-built artifact and runs D1 migrations before dev/prod deploys.

Slack notifications and Workers Builds setup are intentionally out of this generic reference.

### 7. Vite Development

For local development, either:

- use `@cloudflare/vite-plugin` during `vite dev`, or
- proxy `/api` requests to `wrangler dev`.

When proxying to Wrangler:

```typescript
// vite.config.ts
{
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
}
```

## Template Files

| File | Customize |
|------|-----------|
| `wrangler.jsonc` | `name`, `main`, `assets.directory`, `run_worker_first`, `vars`, D1 bindings |
| `worker.ts` | Import paths, path prefix check |
| `drizzle.config.ts` | schema path, migration output path |
| `prepare-d1-migrations.ts` | migration paths if non-standard |
| `verify-migrations.ts` | schema import path |
| `manual-deploy.sh` | environment names if different from `dev`/`preview`/`prod` |
| `cf-deploy.sh` | migration/deploy commands per environment |
