# shadcn/ui Setup

## Directory Convention

Follows the same convention as `tanstack-start/`:

- **Frontend shares package with backend**: Components under `src/web/components/ui/`, styles at `src/web/styles.css`
- **Frontend-only package**: Components under `src/components/ui/`, styles at `src/styles.css`

## Prerequisites

- `vite.config.ts` must exist (shadcn CLI uses it for framework detection)
- Tailwind CSS v4 must be configured: `tailwindcss` + `@tailwindcss/vite` installed, the plugin registered in `vite.config.ts`, and `styles.css` containing `@import 'tailwindcss';`. The `tanstack-start/` pattern already does all of this (see `tanstack-start/template/vite.config.ts` and `tanstack-start/template/src/web/styles.css`). Without it, install and wire them the same way.
- `tsconfig.json` must have the `@/*` → `./src/*` path alias (already in `typescript-package/template/tsconfig.json`)

## Current shadcn Defaults (shadcn 4.x)

What `init` produces today — do not "fix" these back to older conventions:

- `style: "base-nova"` — components are built on Base UI (`@base-ui/react`), not Radix.
- `cn` comes from the npm package `cn` (not `clsx` + `tailwind-merge`). Generated components import `cn` from `"cn"` directly; `utils.ts` is just `export { cn } from 'cn';`.
- `styles.css` gets `@import 'tw-animate-css';`, `@import 'shadcn/tailwind.css';`, `@import '@fontsource-variable/geist';`, the `@theme inline` token mapping, and `:root` / `.dark` CSS variables. `shadcn` itself is added to `dependencies` because of the CSS import.
- Other installed deps: `@base-ui/react`, `class-variance-authority`, `lucide-react`, `tw-animate-css`, `@fontsource-variable/geist`.
- `components.json` contains `iconLibrary`, `rtl`, `menuColor`, `menuAccent`, `registries` in addition to `style` / `tailwind` / `aliases`. Leave them as generated.

## shadcn/ui Init

Do not use `init --defaults`: it forces `--template=next` and also generates a `button` component. Let the CLI detect the framework instead:

```bash
pnpm dlx shadcn@latest init -b base -p nova --yes
```

If a prompt still appears in a non-interactive shell despite `--yes`, prefix the command with `CI=1`.

This writes `components.json`, updates the existing `styles.css` (found via the Tailwind import), installs dependencies, and creates `src/lib/utils.ts`. It does not add components.

### Frontend-only package (default)

The default aliases (`@/components`, `@/lib/utils`, ...) already match. Go straight to adding components.

### Shared package (frontend in `src/web/`)

There is no CLI flag for aliases, and `init` refuses (prompts to overwrite) when `components.json` already exists, so it cannot be pre-created. Fix up after `init`, before adding any component:

1. Update `aliases` in `components.json` to point into `src/web/` (leave other keys as generated; `tailwind.css` should already be `src/web/styles.css`):

   ```json
   {
     "aliases": {
       "components": "@/web/components",
       "utils": "@/web/lib/utils",
       "ui": "@/web/components/ui",
       "lib": "@/web/lib",
       "hooks": "@/web/hooks"
     }
   }
   ```

2. Move the misplaced `src/lib/utils.ts` to `src/web/lib/utils.ts` (`src/lib/` is the shared pure-utility module, not frontend code).

The `@` alias resolves to `./src`, so `@/web/...` correctly maps to `src/web/...`. The `tailwind.config` is empty string for Tailwind v4 (no config file needed).

### Format

`init` writes double-quoted CSS/TS. Run `pnpm fix:oxfmt` once after init so `styles.css`, `components.json`, and `utils.ts` pass `pnpm lint:oxfmt`.

## Adding Components

```bash
pnpm dlx shadcn@latest add button card --yes
```

Generated files under `src/web/components/ui/**` (or `src/components/ui/**`) are vendored output: oxlint ignores them, and the `typescript-package/` `.oxfmtrc.json` ignores `src/web/components/ui/**` too, so `add` / re-`add` never needs a format pass. For a frontend-only package, change that ignore pattern to `src/components/ui/**`. Typecheck still covers them.

Some components also generate files outside `components/ui/`. `add sidebar` creates `src/web/hooks/use-mobile.ts` (plus `input` / `sheet` / `skeleton` / ... components); it is vendored output too, and the `typescript-package/` `oxlint.config.ts` and `.oxfmtrc.json` templates already ignore `src/web/hooks/use-mobile.ts` (`src/hooks/use-mobile.ts` for a frontend-only package). Ignore any other generated file outside `components/ui/` the same way, in both configs.

Component notes:

- `sidebar`: the generated `SidebarProvider` persists the open/collapsed state in a `sidebar_state` cookie.
- `resizable`: targets `react-resizable-panels` v4. The `Resizable*` wrappers keep their names, but the library underneath exports `Group` / `Panel` / `Separator` (not `PanelGroup` / `PanelResizeHandle`), takes the `orientation` prop (not `direction`), uses `usePanelRef` for imperative control, and accepts sizes as rem/px strings as well as percentages. Older examples written for v2/v3 do not apply.
