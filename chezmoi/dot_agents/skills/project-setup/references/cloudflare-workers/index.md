# Cloudflare Workers Setup

Deploy a Cloudflare Workers application with static asset serving, selective worker routing, and optional D1 with Kysely (queries) + Atlas (migrations).

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

When using D1:

```bash
pnpm add kysely kysely-d1
pnpm add -D @cloudflare/workers-types miniflare@<version wrangler depends on>
```

Pin `miniflare` to the exact version in wrangler's `package.json` dependencies so tests run on the same workerd as `wrangler dev`. Allow the `workerd` build in `pnpm-workspace.yaml` (`allowBuilds: { workerd: true }`).

Add `pkgs.atlas` to `flake.nix` (`core/`). Use the nixpkgs build (community edition): the official Atlas binary requires an Atlas Pro login for `atlas migrate lint`, which `migrate:verify` runs.

### 2. Wrangler Configuration

Copy `wrangler.jsonc` to project root and customize:

- `name`: project name
- `main`: worker entrypoint path (e.g. `src/server/worker.ts`)
- `assets.directory`: build output directory (e.g. `./dist/client`)
- `assets.not_found_handling`: keep `single-page-application` for frontend apps
- `assets.run_worker_first`: glob patterns for paths routed to the Worker (e.g. `["/api/*"]`)
- `vars`: non-secret environment variables (safe to commit)
- `env.prod.vars`: production-specific overrides
- `d1_databases`: remove if D1 is not used; otherwise set `database_id` after creating DBs. Keep `migrations_dir` / `migrations_pattern` in every env block because env-level `d1_databases` are not inherited

Do not include app-specific OAuth redirect vars unless the selected auth library requires them.

### 3. Worker Entrypoint

Copy `worker.ts` to the worker entrypoint path. Customize:

- Import path for Hono app and routes
- Path prefix check (default: `/api/`)

### 4. D1 + Kysely + Atlas (optional)

`db/schema.sql` is the desired-state schema. Atlas diffs it against `db/migrations/` to generate versioned migrations in golang-migrate format (`<version>_<name>.up.sql` + `.down.sql`); Wrangler applies only the `.up.sql` files via `migrations_pattern`. Queries go through Kysely on the D1 binding.

1. Copy files:

| File | Copy to |
|------|---------|
| `atlas.hcl` | `atlas.hcl` |
| `schema.sql` | `db/schema.sql` — replace the example table |
| `migrate-verify.sh` | `scripts/migrate-verify.sh` (`chmod +x`) |
| `db/index.ts` | `src/server/db/index.ts` |
| `db/types.ts` | `src/server/db/types.ts` — rewrite to mirror `db/schema.sql` |
| `db/testDb.ts` | `src/server/db/testDb.ts` |
| `dbMiddleware.ts` | `src/server/middlewares/db.ts` |

2. Wire the DB into Hono (`hono/app.ts`): add `Bindings: Env` to `HonoContext` and `db: Kysely<Database>` to its `Variables`, then register `dbMiddleware` for `/api/*` in `routes.ts`. Routes and workflows use `c.var.db`, never `c.env.DB`.

3. Create D1 databases and put the resulting `database_id` values into `wrangler.jsonc`:

```bash
pnpm wrangler d1 create "<project-name>-dev"
pnpm wrangler d1 create "<project-name>-prod"
```

4. Add scripts:

```json
{
  "scripts": {
    "migrate:diff": "atlas migrate diff --env local",
    "migrate:verify": "./scripts/migrate-verify.sh",
    "migrate:local": "wrangler d1 migrations apply <project-name>-dev --local",
    "migrate:dev": "wrangler d1 migrations apply <project-name>-dev --remote",
    "migrate:prod": "wrangler d1 migrations apply <project-name>-prod --remote --env prod"
  }
}
```

5. Generate the initial migration: `pnpm migrate:diff initial`, then `pnpm migrate:verify`.

Schema change flow:

1. Edit `db/schema.sql`.
2. `pnpm migrate:diff <name>` generates the up/down pair and updates `db/migrations/atlas.sum`.
3. Update `src/server/db/types.ts` by hand (`kysely-codegen`'s SQLite dialect requires the native `better-sqlite3`).
4. `pnpm migrate:verify` checks `atlas.sum` integrity, lints for backward-incompatible changes (old Workers run against the new schema during rollout), and fails when `db/schema.sql` and `db/migrations/` drift apart. Run it in CI inside the Nix devShell when `db/**` or `atlas.hcl` changes.

Data migrations (`atlas migrate new`) need a hand-written `.down.sql`. Never rename an applied migration file: Wrangler records applied migrations by file name.

D1 rejects SQL transaction statements (Kysely `transaction()` does not work); use the D1 binding's `batch()` for atomic writes.

Tests: `createMigratedTestDb()` returns a Kysely instance on an isolated Miniflare D1 with all `.up.sql` files applied, so `db-required` tests run on workerd's D1 through the same kysely-d1 path as production. Call `disposeTestDb()` in `afterAll`. Miniflare listens on a local port.

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

`manual-deploy.sh` builds with `CLOUDFLARE_ENV` and delegates to `cf-deploy.sh`. `cf-deploy.sh` deploys an already-built artifact and runs `migrate:dev` / `migrate:prod` (when defined) before dev/prod deploys.

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
| `atlas.hcl` | None — use as-is |
| `schema.sql` | Project tables |
| `migrate-verify.sh` | None — use as-is |
| `db/index.ts` | None — use as-is |
| `db/types.ts` | Mirror `db/schema.sql` |
| `db/testDb.ts` | `migrationsDir` relative path if placed elsewhere, `compatibilityDate` to match `wrangler.jsonc` |
| `dbMiddleware.ts` | Import paths |
| `manual-deploy.sh` | environment names if different from `dev`/`preview`/`prod` |
| `cf-deploy.sh` | migration/deploy commands per environment |
