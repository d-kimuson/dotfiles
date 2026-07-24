# TanStack Start

TanStack Start を使った React application 構成。SPA が必要な場合も TanStack Start の `spa` mode を選ぶ。

## Mode

Setup 時にどちらかを選ぶ。

| Mode | 用途 | Build behavior |
|------|------|----------------|
| `prerender` | SEO や初期 HTML が必要なアプリ | `/` と `/home` を pre-render する |
| `spa` | 旧 TanStack Router SPA 相当 | pre-render しない SPA shell として配信する |

Cloudflare Workers Assets で配信する場合、どちらの mode でも `not_found_handling: "single-page-application"` を使う。`404-page` fallback は Google crawler 等に 404 と判定されるため避ける。

## Pre-render `/` + `/home` Pattern

`prerender` mode では `/` と `/home` を分ける。

- `/` は pre-render 対象にするが、UI は描画せず body を空に近く保つ。
- `/` は hydrate 後に `/home` へ `replace` navigation する。
- `/home` が実際の top page UI を持つ。
- Cloudflare fallback は SPA なので、未 pre-render path は client routing に任せる。

この構成により、`/` の pre-render 済み HTML が他 path の fallback 時に一瞬表示されるちらつきを避けられる。

## Architecture

- **SSR なし**: TanStack Start は SPA shell と build-time pre-render のために使う。request-time SSR は使わない。
- **SPA shell**: root route は `shellComponent` を使う（`component` ではなく）。
- **データ取得**: `createServerFn` は使わず、`@tanstack/react-query` + API client（Hono RPC 等）で client-side から取得する。
- **Routing**: TanStack Router file-based routing。`app/**/page.tsx` を route file とする。

## Setup Sequence

### 1. Install Dependencies

```bash
pnpm add @tanstack/react-start @tanstack/react-router @tanstack/react-query react react-dom
pnpm add -D @vitejs/plugin-react @tanstack/router-plugin vite
```

Optional devtools:

```bash
pnpm add @tanstack/react-devtools @tanstack/react-router-devtools
```

### 2. Vite Configuration

Copy `vite.config.ts` to project root and customize:

- `tanstackStartMode`: setup choice (`'prerender'` or `'spa'`)
- `srcDirectory`: TanStack Start source root
- `router.routesDirectory`: `./app`
- `router.routeToken`: `page`
- `define.__DISABLE_AUTH__` only when auth bypass is selected
- Cloudflare plugin / proxy / Tailwind plugin as needed

For `prerender` mode, keep `/` and `/home` in `getPrerenderPages()`.

### 3. Router

Copy `router.tsx` to `{srcDirectory}/router.tsx`.

- `scrollRestoration: true`
- `defaultPreload: 'intent'`
- `defaultPreloadStaleTime: 0`

### 4. Root Route

Copy `app/__root/page.tsx` to `{srcDirectory}/app/__root/page.tsx` and customize:

- `head()` meta tags, links, scripts
- provider/layout tree in `RootDocument`
- keep `shellComponent`
- keep `<HeadContent />` and `<Scripts />`

### 5. Index and Home Routes

For `prerender` mode, copy:

- `app/index/page.tsx` → `{srcDirectory}/app/index/page.tsx`
- `app/home/page.tsx` → `{srcDirectory}/app/home/page.tsx`

For `spa` mode, `app/index/page.tsx` may contain the main UI directly instead of redirecting to `/home`.

### 6. Source Directory Structure

```text
{srcDirectory}/
  router.tsx
  routeTree.gen.ts        # Auto-generated; do not edit
  styles.css
  app/
    __root/
      page.tsx
      providers/AppProvider.tsx
    index/page.tsx        # `/` empty redirect route for prerender mode
    home/page.tsx         # real top page UI for prerender mode
  apis/                   # concrete API query/mutation hooks
  components/ui/          # shadcn/ui generated components
  lib/
    api/
      client.ts
      queryClient.ts
    test/
      renderHook.tsx
  shared/                 # cross-feature code
```

## Cloudflare Workers Assets

When using Cloudflare Workers Assets, set SPA fallback regardless of mode:

```jsonc
{
  "assets": {
    "directory": "./dist/client",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  }
}
```

## Template Files

| File | Customize |
|------|-----------|
| `vite.config.ts` | `tanstackStartMode`, `srcDirectory`, plugins |
| `router.tsx` | Router options |
| `app/__root/page.tsx` | meta/links/scripts, layout/provider tree |
| `app/__root/providers/AppProvider.tsx` | common providers |
| `app/index/page.tsx` | prerender empty redirect route, or SPA top route |
| `app/home/page.tsx` | top page UI for prerender mode |
| `lib/api/queryClient.ts` | TanStack Query defaults |
| `lib/test/renderHook.tsx` | Common hook test helper with Router and QueryClient providers |
