# SPA

## Install

```bash
pnpm add @tanstack/react-query @tanstack/react-router react react-dom react-hook-form
pnpm add -D vite vitest @testing-library/react @types/react @types/react-dom @vitejs/plugin-react
```

## vite.config.ts

```typescript:vite.config.ts
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

## index.html

```html:index.html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Delegation Platform" />
    <title>Delegation Platform</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## src/routes/__root.tsx

```tsx:src/routes/__root.tsx
import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
    </>
  ),
});
```

## src/lib/api/createQueryClient.ts

```typescript:src/lib/api/createQueryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  });
};
```

## src/lib/api/QueryClientProviderWrapper.tsx

```tsx:src/lib/api/QueryClientProviderWrapper.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import type { FC, PropsWithChildren } from "react";
import { createQueryClient } from "./createQueryClient";

const queryClient = createQueryClient();

export const QueryClientProviderWrapper: FC<PropsWithChildren> = ({
  children,
}) => {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
```

## src/main.tsx

```tsx:src/main.tsx
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { QueryClientProviderWrapper } from "./lib/api/QueryClientProviderWrapper";
import { routeTree } from "./routeTree.gen";

import "./styles.css"; // tailwind css style

const router = createRouter({
  routeTree,
  context: {},
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
  defaultNotFoundComponent: () => <div>Not Found</div>,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <QueryClientProviderWrapper>
      <RouterProvider router={router} />
    </QueryClientProviderWrapper>
  </StrictMode>,
);
```
