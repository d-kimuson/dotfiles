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

For local Node server development without Cloudflare Workers:

```bash
pnpm add @hono/node-server
```

### tsconfig.json adjustments for Node.js

For backend-only (no DOM):

- Change `lib` to `["esnext"]` (remove `"dom"`, `"dom.iterable"`).
- Add `"types": ["node"]` to `compilerOptions`.

## Architecture

Default request flow:

```text
routes -> workflows -> services -> optional repositories/models -> drizzle
```

- `routes`: HTTP boundary adapters. Parse/validate inputs, read Hono context, call one workflow, and map workflow results to HTTP responses.
- `workflows`: transaction scripts. Orchestrate DB reads/writes, coordinate pure services, and return ADT-style results.
- `services`: pure business rules. No DB, network, clock, random, or environment access.
- `repositories`: optional persistence helpers. Use only when reuse or query complexity justifies a named abstraction.
- `models`: optional domain/API conversion contracts. Use when conversion, validation, or immutable domain shape is valuable.

Do not create layers just to satisfy a diagram. A straightforward workflow may call Drizzle directly.

Expected outcomes should be returned as ADT-style results instead of exceptions:

```ts
type UpdateUserResult = { status: 'updated'; user: UserResponse } | { status: 'not_found' };
```

Routes should map these results exhaustively to responses.

## Template Files

| File | Customize |
|------|-----------|
| `app.ts` | Add context variables to `HonoContext` as needed |
| `routes.ts` | Compose top-level routes and middlewares |
| `server.ts` | Node dev server only; set `defaultPort` |
| `main.ts` | Node dev server entrypoint |
| `client.ts` | Typed Hono client for frontend |
| `authMode.ts` | Optional `DISABLE_AUTH` helper for apps with authentication/E2E bypass |

### File Placement

- Shares package with frontend: Copy `app.ts`, `routes.ts`, `server.ts` to `src/server/`. Copy `main.ts` to `src/` and update import to `./server/server`.
- API-only package: Copy all files to `src/`.

## Context Variables

Keep request-scoped values in Hono context and pass them explicitly into workflows.

Typical variables:

- `env`: `'local' | 'dev' | 'preview' | 'prod'`
- `user`: session user or `undefined`
- `drizzleDb`: DB handle when using Drizzle/D1

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

Copy `client.ts` to frontend's `src/web/lib/api/client.ts`:

- Single fullstack package: import `RouteType` from `../../../server/routes` when `client.ts` is placed at `src/web/lib/api/client.ts`, or adjust to the correct relative path.
- Separate package: import `RouteType` from `<pkg-name-backend>/types`.

Concrete TanStack Query hooks should live under `src/web/apis/<domain>/` and use this client. Feature components should not call this client directly.

## Auth Bypass for E2E (optional)

If the application has user authentication, copy `authMode.ts` to `src/lib/authMode.ts` and wire `isAuthDisabled()` into both backend auth guards and frontend auth boundaries.

For Vite/TanStack Start frontend code, expose the env value at build/dev time:

```ts
define: {
  __DISABLE_AUTH__: JSON.stringify(process.env['DISABLE_AUTH'] ?? 'false'),
}
```

Use `DISABLE_AUTH=true` only for QA/E2E/dev-server verification. Do not enable it in production or preview deployments.

## Testing

- Pure services/models: colocated unit tests, no DB setup.
- Workflows/repositories: DB-required tests under `src/server/**/workflows/**/*.test.{ts,tsx}` and `src/server/**/repositories/**/*.test.{ts,tsx}`.
- Prefer in-memory SQLite for Drizzle workflow/repository tests when D1/SQLite is the production store.
