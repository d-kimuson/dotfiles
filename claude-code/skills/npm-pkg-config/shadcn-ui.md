# shadcn-ui

## setup tailwind (if framework is Vite, and not configured)

Next.js の場合は後続の init コマンドでセットアップされるので不要

```bash
pnpm add tailwindcss @tailwindcss/vite
```

```css:src/index.css
@import "tailwindcss";
```

```json:tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

tsconfig.app.json 等に分かれている場合はすべてに追加

```typescript:vite.config.ts
import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      e"@": resolve(__dirname, "./src"),
    },
  },
})
```

## setup shadcn-ui

```bash
pnpm dlx shadcn@latest init --base-color neutral --yes --src-dir --css-variables
```
