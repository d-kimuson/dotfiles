# Hono (Backend API)

## Directory Convention

- **API shares package with frontend** (e.g. fullstack single-package or monorepo where one package owns both): Hono code under `src/server/`
- **API-only package** (standalone repo or dedicated backend package in a workspace): Hono code directly in `src/`

## Install

```bash
pnpm add hono @hono/node-server
```

## Template Files

| File | Customize |
|------|-----------|
| `app.ts` | Add context variables to `HonoContext` as needed |
| `routes.ts` | Replace example routes with actual API routes, update `<project-name>` |
| `server.ts` | Set `<default-port>` to desired port number |
| `main.ts` | None |

### File Placement

- Shares package with frontend: Copy to `src/server/`
- API-only package: Copy to `src/`

## Multi-Package Type Export

When the API is in a separate workspace package, export types for the frontend package.

Create `src/types.ts`:

```typescript
export type { HonoAppType } from "./hono/app";
export type { ApiSchema, RouteType } from "./hono/route";
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

Copy `client.ts` to frontend's `src/lib/api/`:
- Update import path: shared package uses `../../server/hono/route`, separate package uses `<pkg-name-backend>/types`

## MSW Mocking (hono-rpc-msw-adapter)

Use `@kimuson/hono-rpc-msw-adapter` for type-safe MSW mock handlers derived from Hono route types.

```bash
pnpm add -D @kimuson/hono-rpc-msw-adapter msw
```

Setup (once per project, in test setup or mock config):

```typescript
import { setConfig } from '@kimuson/hono-rpc-msw-adapter';
import type { RouteType } from '../../server/hono/route'; // or '<pkg-name-backend>/types'

setConfig({ baseUrl: 'http://localhost:<port>' });

declare module '@kimuson/hono-rpc-msw-adapter/register' {
  interface Register {
    routeType: RouteType;
  }
}
```

Create handlers:

```typescript
import { createHandler } from '@kimuson/hono-rpc-msw-adapter';

export const infoHandler = createHandler(
  '/info',
  '$get',
  async () => ({
    status: 200,
    output: { status: 'healthy', server: '<project-name>' },
  }),
);
```
