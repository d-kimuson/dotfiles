# TanStack Start Static (Pre-rendered SPA)

TanStack Start を使った pre-rendering ありの SPA 構成。ビルド時に全ページを静的 HTML として生成し、Cloudflare Workers Assets 等で配信する。

## Architecture

- **SSR なし**: TanStack Start はビルド時の pre-rendering のみに使用。リクエスト時の SSR は行わない
- **SPA shell**: `shellComponent` を使用（`component` ではなく）。クライアントサイドでハイドレーション
- **データ取得**: `createServerFn` は使わず、`@tanstack/react-query` + API クライアント（hono RPC 等）でクライアントサイドから取得
- **ルーティング**: TanStack Router のファイルベースルーティング

## Setup Sequence

### 1. Install Dependencies

```bash
pnpm add @tanstack/react-start @tanstack/react-router @tanstack/router-plugin @tanstack/react-query
pnpm add -D @vitejs/plugin-react
```

Optional devtools:

```bash
pnpm add @tanstack/react-devtools @tanstack/react-router-devtools
```

### 2. Vite Configuration

Copy `vite.config.ts` to project root and customize:

- `srcDirectory`: TanStack Start のソースルート（`routes/`, `router.tsx` が置かれるディレクトリ）
- `pages`: pre-render するページのリスト。静的パスを列挙するか、JSON データから動的に生成
- Tailwind, devtools 等のプラグインは必要に応じて追加/削除

### 3. Router

Copy `router.tsx` to `{srcDirectory}/router.tsx`.

- `scrollRestoration: true` でスクロール位置を復元
- `defaultPreload: 'intent'` でホバー時にプリロード

### 4. Root Route

Copy `__root.tsx` to `{srcDirectory}/routes/__root.tsx` and customize:

- `head()` の meta tags, links, scripts をプロジェクトに合わせる
- `shellComponent` を使用すること（`component` ではなく）— SPA shell モードを示す
- `<HeadContent />` と `<Scripts />` は必須

### 5. Source Directory Structure

```
{srcDirectory}/
  router.tsx              # Router creation
  routeTree.gen.ts        # Auto-generated (do not edit)
  styles.css              # Tailwind entry
  routes/
    __root.tsx            # Root layout (shellComponent)
    index.tsx             # / page
    ...
  app/                    # Feature modules
  components/             # Shared UI components
  lib/
    api/
      client.ts           # API client (hono RPC etc.)
      createQueryClient.ts
      QueryClientProviderWrapper.tsx
```

### 6. Build Configuration

TanStack Start の pre-rendering はビルド時に実行される:

```json
{
  "scripts": {
    "build": "vite build"
  }
}
```

ビルド出力は `dist/client/` に生成され、Cloudflare Workers Assets 等でそのまま配信可能。

## Pre-render Pages の指定方法

### 静的パス

```typescript
const pages = [
  { path: '/', prerender: { enabled: true, crawlLinks: false } },
  { path: '/about', prerender: { enabled: true, crawlLinks: false } },
];
```

### JSON データからの動的生成

```typescript
import items from './data/items.json' with { type: 'json' };

const dynamicPages = items.map(({ id }) => ({
  path: `/items/${id}`,
  prerender: { enabled: true, crawlLinks: false },
}));
```

`crawlLinks: false` と `autoStaticPathsDiscovery: false` を設定し、pre-render 対象を明示的に制御する。

## Template Files

| File | Customize |
|------|-----------|
| `vite.config.ts` | `srcDirectory`, `pages`, plugins |
| `router.tsx` | Router options |
| `__root.tsx` | `head()` meta/links/scripts, layout structure |
