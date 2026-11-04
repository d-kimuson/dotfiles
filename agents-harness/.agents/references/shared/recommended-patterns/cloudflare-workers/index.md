# Cloudflare Workers Setup

Deploy a Cloudflare Workers application with static asset serving, selective worker routing, and optional D1 with Kysely (queries) + Atlas (migrations). Uses the `cf` CLI with a typed `cloudflare.config.ts`; do not add a Wrangler configuration file.

`cf` is in beta. Prefer `cf cli search "<task>"` and `<command> --help` over memory when a command below fails. Docs: https://developers.cloudflare.com/cf/llms.txt

## Architecture

- Static assets (HTML/JS/CSS) are served directly by Cloudflare Workers Assets.
- Only specific paths (e.g. `/api/*`) are routed to the Worker via `assets.runWorkerFirst`.
- The Worker itself double-checks the path and returns 404 for non-matching Worker paths.
- For frontend apps, use `assets.notFoundHandling: 'single-page-application'` for both SPA and pre-rendered TanStack Start apps. Do not use `404-page` fallback for SPA-routed pages because crawlers can treat fallback pages as not found.

## Setup Sequence

### 1. Install Dependencies

```bash
pnpm add -D cf vite @cloudflare/vite-plugin@beta
```

When using D1:

```bash
pnpm add kysely kysely-d1
pnpm add -D @cloudflare/workers-types wrangler miniflare@<version wrangler depends on>
```

`wrangler` is only for tests (`unstable_splitSqlQuery` in `src/server/db/testDb.ts`). Pin `miniflare` to the exact version in wrangler's `package.json` dependencies. Allow the `workerd` build in `pnpm-workspace.yaml` (`allowBuilds: { workerd: true }`).

Add `pkgs.atlas` to `flake.nix` (`project-code/`). Use the nixpkgs build (community edition): the official Atlas binary requires an Atlas Pro login for `atlas migrate lint`, which `migrate:verify` runs.

Add `.cloudflare/` (build output, generated types, local dev state) to `.gitignore`.

### 2. Project Configuration

Copy `cloudflare.config.ts` and customize:

- `name`: Worker name per mode. Each mode returns a complete config; nothing is inherited, so keep shared fields in `common`.
- `entrypoint`: worker entrypoint path
- `assets.runWorkerFirst`: glob patterns for paths routed to the Worker
- `env`: `bindings.text()` for non-secret vars, `bindings.secret()` to declare secrets, `bindings.d1()` for D1. Remove `DB` if D1 is not used.

Use `prod`, not `production`, as the production mode name: `cf build` / `cf deploy` default to `production`, so a plain deploy must not hit prod.

Assets come from the Vite client build; there is no assets directory setting. To disable source map upload, set `build.sourcemap: false` on the Worker's Vite environment.

### 3. Worker Entrypoint

Copy `src/server/worker.ts`. Customize:

- Import path for Hono app and routes
- Path prefix check (default: `/api/`)

Generated binding types (`Env`) are written to `.cloudflare/types/index.d.ts` during `cf dev` / `cf build`, or by `pnpm exec cf workers types`. Add `.cloudflare/types` to `tsconfig.json` `include`.

### 4. D1 + Kysely + Atlas (optional)

`db/schema.sql` is the desired-state schema. Atlas diffs it against `db/migrations/` to generate versioned migrations in golang-migrate format (`<version>_<name>.up.sql` + `.down.sql`); `cf d1 migrations apply` applies only the `.up.sql` files via `--pattern`. Queries go through Kysely on the D1 binding.

1. Copy files:

| File | Customize |
|------|-----------|
| `atlas.hcl` | None — use as-is |
| `db/schema.sql` | Replace the example table |
| `scripts/migrate-verify.sh` | None — use as-is |
| `src/server/db/index.ts` | None — use as-is |
| `src/server/db/types.ts` | Rewrite to mirror `db/schema.sql` |
| `src/server/db/testDb.ts` | `compatibilityDate` to match `cloudflare.config.ts` |
| `src/server/middlewares/db.ts` | Import paths |

2. Wire the DB into Hono (`hono/`'s `src/server/app.ts`): add `Bindings: Env` to `HonoContext` and `db: Kysely<Database>` to its `Variables`, then register `dbMiddleware` for `/api/*` in `routes.ts`. Routes and workflows use `c.var.db`, never `c.env.DB`.

3. Create D1 databases and put the resulting IDs into `cloudflare.config.ts` and the migrate scripts:

```bash
pnpm exec cf d1 create --name "<project-name>-dev"
pnpm exec cf d1 create --name "<project-name>-prod"
```

4. Add scripts. `cf d1 migrations apply` takes the database ID and does not read the migrations directory from config:

```json
{
  "scripts": {
    "migrate:diff": "atlas migrate diff --env local",
    "migrate:verify": "./scripts/migrate-verify.sh",
    "migrate:local": "cf d1 migrations apply <dev-d1-database-id> --local --persist-to .cloudflare/state --dir db/migrations --pattern 'db/migrations/*.up.sql'",
    "migrate:dev": "cf d1 migrations apply <dev-d1-database-id> --dir db/migrations --pattern 'db/migrations/*.up.sql'",
    "migrate:prod": "cf d1 migrations apply <prod-d1-database-id> --mode prod --dir db/migrations --pattern 'db/migrations/*.up.sql'"
  }
}
```

`--persist-to .cloudflare/state` targets the dev server's local data (the default `--local` state is shared across projects). Confirm `cf dev` sees the migrated tables.

5. Generate the initial migration: `pnpm migrate:diff initial`, then `pnpm migrate:verify`.

Schema change flow:

1. Edit `db/schema.sql`.
2. `pnpm migrate:diff <name>` generates the up/down pair and updates `db/migrations/atlas.sum`.
3. Update `src/server/db/types.ts` by hand (`kysely-codegen`'s SQLite dialect requires the native `better-sqlite3`).
4. `pnpm migrate:verify` checks `atlas.sum` integrity, lints for backward-incompatible changes (old Workers run against the new schema during rollout), and fails when `db/schema.sql` and `db/migrations/` drift apart. Run it in CI inside the Nix devShell when `db/**` or `atlas.hcl` changes.

Data migrations (`atlas migrate new`) need a hand-written `.down.sql`. Never rename an applied migration file: applied migrations are recorded by file name.

D1 rejects SQL transaction statements (Kysely `transaction()` does not work); use the D1 binding's `batch()` for atomic writes.

Tests: `createMigratedTestDb()` returns a Kysely instance on an isolated Miniflare D1 with all `.up.sql` files applied, so `db-required` tests run on workerd's D1 through the same kysely-d1 path as production. Call `disposeTestDb()` in `afterAll`. Miniflare listens on a local port.

### 5. Secrets

Declare each secret with `bindings.secret()` in `cloudflare.config.ts`. `cf` has no `secret put` yet; set values with Wrangler, passing the Worker name because Wrangler does not read `cloudflare.config.ts`:

```bash
npx wrangler secret put SECRET_NAME --name <project-name>
npx wrangler secret put SECRET_NAME --name <project-name>-prod
```

Or upload them with a version: `cf deploy --secrets-file <path>` (JSON or `.env`). Never commit secret files.

### 6. Deploy Scripts

Copy `scripts/manual-deploy.sh` and `scripts/cf-deploy.sh` (executable).

`manual-deploy.sh` runs `cf build --mode <mode>` and delegates to `cf-deploy.sh`. `cf-deploy.sh` deploys the already-built output with `cf deploy --prebuilt` and runs `migrate:dev` / `migrate:prod` (when defined) before dev/prod deploys. `preview` uploads a dev Worker version without deploying it (`cf workers versions create`).

A prebuilt deploy must use the mode recorded by the build. In CI, authenticate with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; `cf deploy --dry-run` checks without uploading.

Slack notifications and Workers Builds setup are intentionally out of this generic reference.

### 7. Vite Development

Add `cloudflare()` from `@cloudflare/vite-plugin` to `vite.config.ts` plugins. `cf dev` runs Vite with the Worker, so drop any `/api` proxy to a separate dev server. `cf dev` forwards only `--mode`; set the port in `vite.config.ts`.

## Template Files

| File | Customize |
|------|-----------|
| `cloudflare.config.ts` | Worker names, `entrypoint`, `runWorkerFirst`, `env` bindings, D1 IDs |
| `src/server/worker.ts` | Import paths, path prefix check |
| `scripts/manual-deploy.sh` | Environment names if different from `dev`/`preview`/`prod` |
| `scripts/cf-deploy.sh` | Migration/deploy commands per environment |
| D1 files | See step 4 |
