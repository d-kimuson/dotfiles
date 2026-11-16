# Hono (Backend API)

## Directory Convention

- **API shares package with frontend** (fullstack single-package): Hono code under `src/server/`.
- **API-only package**: Hono code directly in `src/`.

Recommended fullstack shape:

```text
src/server/
  app.ts
  routes.ts
  worker.ts                 # Cloudflare Worker entrypoint when used
  middlewares/
  db/
  domain/
    <domain>/
      routes.ts
      workflows/
      services/
      repositories/
      models/
```

## Install

```bash
pnpm add hono
pnpm add -D @types/node
```

## Runtime Branch

Pick one at setup:

| Runtime | Dev server | Entrypoint |
|---------|-----------|------------|
| Node.js (no Workers) | `tsx watch src/main.ts` via `@hono/node-server` | `src/main.ts` → `src/server/server.ts` |
| Cloudflare Workers | see `cloudflare-workers/` | `src/server/worker.ts` (skip `main.ts` / `server.ts`) |

### Node.js

```bash
pnpm add @hono/node-server
pnpm add -D tsx
pnpm approve-builds esbuild   # tsx needs esbuild's install script; or add `esbuild: true` under allowBuilds
```

`src/main.ts` uses extensionless relative imports (bundler resolution), which plain `node` cannot run; use `tsx`. Add scripts (with `tanstack-start/`, run both in parallel):

```json
{
  "scripts": {
    "dev": "run-p dev:*",
    "dev:web": "vite dev",
    "dev:server": "tsx watch src/main.ts"
  }
}
```

The API server listens on `8787` (`defaultPort` in `src/server/server.ts`), which is the port the `tanstack-start/` Vite dev server proxies `/api` to. Change both together. `8787` is also wrangler's default, so switching to Workers later needs no proxy change.

#### Production on Node (gap)

The templates only cover local development on Node: `vite build` emits the SPA to `dist/client`, and nothing serves it together with the API. If the project deploys to Node, add this explicitly rather than assuming it exists. Recommended minimal approach: in a production entrypoint, mount `serveStatic({ root: './dist/client' })` from `@hono/node-server/serve-static` after the API routes, with an SPA fallback to the shell HTML emitted in `dist/client` (check the file name after `vite build`; `spa` mode emits a `_shell` page) for non-`/api` GET requests, and bundle/run it with `tsx` or a build step. Otherwise prefer `cloudflare-workers/`, which already handles assets + SPA fallback.

### tsconfig.json adjustments

- Fullstack single package (`src/server` + `src/web`): keep `lib` as `["dom", "dom.iterable", "esnext"]` — the same tsconfig type-checks the frontend. Add `"node"` to `types`.
- Backend-only package (no DOM): change `lib` to `["esnext"]` (remove `"dom"`, `"dom.iterable"`) and set `"types": ["node"]`.

## Architecture

Default request flow:

```text
routes -> workflows -> services -> optional repositories/models -> kysely
```

- `routes`: HTTP boundary adapters. Parse/validate inputs, read Hono context, call one workflow, and map workflow results to HTTP responses.
- `workflows`: transaction scripts. Orchestrate DB reads/writes, coordinate pure services, and return ADT-style results.
- `services`: pure business rules. No DB, network, clock, random, or environment access.
- `repositories`: optional persistence helpers. Use only when reuse or query complexity justifies a named abstraction.
- `models`: optional domain/API conversion contracts. Use when conversion, validation, or immutable domain shape is valuable.

Do not create layers just to satisfy a diagram. A straightforward workflow may query Kysely directly.

Expected outcomes should be returned as ADT-style results instead of exceptions:

```ts
type UpdateUserResult = { status: 'updated'; user: UserResponse } | { status: 'not_found' };
```

Routes should map these results exhaustively to responses.

## Template Files

| File | Customize |
|------|-----------|
| `src/server/app.ts` | Add context variables to `HonoContext` as needed |
| `src/server/routes.ts` | Compose top-level routes and middlewares |
| `src/server/server.ts` | Node runtime only; `defaultPort` (8787) must match the Vite `/api` proxy |
| `src/main.ts` | Node runtime entrypoint — run with `tsx` |
| `src/web/lib/api/client.ts` | Typed Hono client for frontend |

### File Placement

- Shares package with frontend: Copy the template as laid out.
- API-only package: Copy `src/server/*` and `src/main.ts` to `src/`, update the `main.ts` import to `./server`, and skip `src/web/`.

## Context Variables

Keep request-scoped values in Hono context and pass them explicitly into workflows.

Typical variables:

- `env`: `'local' | 'dev' | 'preview' | 'prod'`
- `user`: session user or `undefined` (typed as `unknown` in the template — replace with the real user type; `unknown | undefined` trips `no-redundant-type-constituents`)
- `db`: `Kysely<Database>` handle when using D1 (see `cloudflare-workers/`)

Avoid global mutable request state and generic DI frameworks.

## Multi-Package Type Export

When the API is in a separate workspace package, export types for the frontend package.

Create `src/types.ts`:

```typescript
export type { HonoAppType } from './hono/app';
export type { ApiSchema, RouteType } from './hono/routes';
```

Add to `package.json`:

```json
{
  "exports": {
    "./types": "./src/types.ts"
  }
}
```

## Frontend API Client

When both frontend and backend exist, set up a typed Hono client.

Copy `src/web/lib/api/client.ts` to the frontend:

- Single fullstack package: use as-is (imports `RouteType` from `../../../server/routes`). The `typescript-package/` oxlint config has a `client.ts` override that allows this one type-only import from outside `server/**/models`.
- `HttpError` declares its fields explicitly instead of constructor parameter properties, because `erasableSyntaxOnly` rejects parameter properties (TS1294). Keep it that way.
- Separate package: import `RouteType` from `<pkg-name-backend>/types`.

Concrete TanStack Query hooks should live under `src/web/apis/<domain>/` and use this client. Feature components should not call this client directly.

## Testing

- Pure services/models: colocated unit tests, no DB setup.
- Workflows/repositories: DB-required tests under `src/server/**/workflows/**/*.test.{ts,tsx}` and `src/server/**/repositories/**/*.test.{ts,tsx}`.
- With D1, build the test DB with `createMigratedTestDb()` from `cloudflare-workers/` so tests run on workerd's D1 through the same kysely-d1 path as production.
