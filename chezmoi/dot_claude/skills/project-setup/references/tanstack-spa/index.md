# TanStack SPA (Frontend)

## Directory Convention

- **Frontend shares package with backend** (e.g. fullstack single-package): Frontend code under `src/web/`
- **Frontend-only package** (standalone repo or dedicated frontend package in a workspace): Frontend code directly in `src/`

## Install

```bash
pnpm add @tanstack/react-query @tanstack/react-router react react-dom react-hook-form
pnpm add -D vite @testing-library/react @types/react @types/react-dom @vitejs/plugin-react
pnpm add -D @tanstack/router-plugin
```

## Template Files

| File | Customize |
|------|-----------|
| `vite.config.ts` | Remove `tailwindcss()` plugin if not using Tailwind |
| `index.html` | Update `<title>`, `<meta description>`, `lang` attribute |
| `main.tsx` | None — copy to `src/main.tsx` |

### File Placement

- Shares package with backend: Copy source files to `src/web/`
- Frontend-only package: Copy source files to `src/`

### Additional source files to create

Copy these files into the source directory (`src/` or `src/web/`):

- `routes/__root.tsx` — root route template (copy `__root.tsx`)
- `lib/api/createQueryClient.ts` — copy `createQueryClient.ts`
- `lib/api/QueryClientProviderWrapper.tsx` — copy `QueryClientProviderWrapper.tsx`
- `styles.css` — create with `@import "tailwindcss";` (if using Tailwind)

## Shared Package Config Changes

When frontend lives in `src/web/` instead of `src/`, adjust the following:

### vite.config.ts

Add `routesDirectory` and `generatedRouteTree` to the TanStack Router plugin, and add `server.watch.ignored`:

```typescript
tanstackRouter({
  target: "react",
  autoCodeSplitting: true,
  routesDirectory: "./src/web/routes",
  generatedRouteTree: "./src/web/routeTree.gen.ts",
}),
```

```typescript
server: {
  watch: {
    ignored: ["**/routeTree.gen.ts"],
  },
},
```

### index.html

Update the script entry point:

```html
<script type="module" src="/src/web/main.tsx"></script>
```

### main.tsx

Import paths stay relative — no changes needed since `main.tsx` moves into `src/web/` alongside `routeTree.gen.ts` and `styles.css`.
