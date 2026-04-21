# shadcn/ui Setup

## Directory Convention

Follows the same convention as `tanstack-spa/`:

- **Frontend shares package with backend**: Components under `src/web/components/ui/`, styles at `src/web/styles.css`
- **Frontend-only package**: Components under `src/components/ui/`, styles at `src/styles.css`

## Prerequisites

- `vite.config.ts` must exist (shadcn CLI uses it for framework detection)
- Tailwind CSS must be configured (handled by `tanstack-spa` setup or manually)
- `tsconfig.json` must have `@/*` path alias pointing to `./src/*`

## Tailwind CSS Setup (Vite only, skip for Next.js)

If not already configured by the frontend framework setup:

```bash
pnpm add tailwindcss @tailwindcss/vite
```

Create styles.css (`src/styles.css` or `src/web/styles.css`):
```css
@import "tailwindcss";
```

Ensure `vite.config.ts` has the alias and plugin configured (see `tanstack-spa/vite.config.ts`).

## shadcn/ui Init

### Frontend-only package (default)

```bash
pnpm dlx shadcn@latest init --defaults
```

### Shared package (frontend in `src/web/`)

Run init then update `components.json` aliases to point into `src/web/`:

```bash
pnpm dlx shadcn@latest init --defaults
```

Update `components.json`:

```json
{
  "tailwind": {
    "css": "src/web/styles.css",
    "config": ""
  },
  "aliases": {
    "components": "@/web/components",
    "utils": "@/web/lib/utils",
    "ui": "@/web/components/ui",
    "lib": "@/web/lib",
    "hooks": "@/web/hooks"
  }
}
```

The `@` alias resolves to `./src`, so `@/web/...` correctly maps to `src/web/...`. The `tailwind.config` is empty string for Tailwind v4 (no config file needed).
