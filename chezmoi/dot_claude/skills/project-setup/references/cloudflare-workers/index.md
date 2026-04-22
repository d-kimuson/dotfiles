# Cloudflare Workers Setup

Deploy a Cloudflare Workers application with static asset serving and selective worker routing.

## Architecture

- Static assets (HTML/JS/CSS) are served directly by Cloudflare's asset serving
- Only specific paths (e.g. `/api/*`) are routed to the Worker via `run_worker_first`
- The Worker itself double-checks the path and returns 404 for non-matching requests

## Setup Sequence

### 1. Install Dependencies

```bash
pnpm add -D wrangler @cloudflare/vite-plugin
```

### 2. Wrangler Configuration

Copy `wrangler.jsonc` to project root and customize:

- `name`: project name
- `main`: worker entrypoint path (e.g. `src/server/worker.ts`)
- `assets.directory`: build output directory (e.g. `./dist/client`)
- `assets.run_worker_first`: glob patterns for paths routed to the Worker (e.g. `["/api/*"]`)
- `vars`: non-secret environment variables (safe to commit)
- `env.prod.vars`: production-specific overrides

Remove unused bindings (`kv_namespaces`, `d1_databases`) if not needed.

### 3. Worker Entrypoint

Copy `worker.ts` to the worker entrypoint path. Customize:

- Import path for Hono app
- Path prefix check (default: `/api/`)

### 4. Environment Management

**Non-secret vars**: Define in `wrangler.jsonc` under `vars` (dev) and `env.prod.vars` (prod).

**Secrets**: Set via Wrangler CLI, never commit to source:

```bash
# Set a secret for dev environment
pnpm wrangler secret put SECRET_NAME

# Set a secret for prod environment
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

### 5. Deploy Script

Copy `deploy.sh` to `scripts/deploy.sh` and make executable:

```bash
chmod +x scripts/deploy.sh
```

Add deploy scripts to `package.json`:

```json
{
  "scripts": {
    "dev:api": "wrangler dev --port 8787",
    "deploy:remote": "wrangler deploy --minify",
    "deploy:preview": "wrangler versions upload --minify",
    "deploy": "bash scripts/deploy.sh"
  }
}
```

### 6. Vite Dev Proxy

For local development, proxy `/api` requests to the wrangler dev server:

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

Run both servers in parallel:

```json
{
  "scripts": {
    "dev": "run-p dev:*",
    "dev:web": "vite dev --port 34567",
    "dev:api": "wrangler dev --port 8787"
  }
}
```

## Template Files

| File | Customize |
|------|-----------|
| `wrangler.jsonc` | `name`, `main`, `assets.directory`, `run_worker_first` patterns, `vars`, bindings |
| `worker.ts` | Import paths, path prefix check |
| `deploy.sh` | Environment names if different from `dev`/`preview`/`prod` |
