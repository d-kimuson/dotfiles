# TypeScript Package Setup

Complete setup for a TypeScript package: npm config, TypeScript, linting/formatting, testing, Git hooks, and CI.

## Directory Convention

- Entrypoint applications (frontend, backend, desktop, mobile, etc.) → `apps/${name}`
- Shared internal packages → `packages/${name}`

For a single fullstack package, use:

```text
src/
  lib/       # shared pure utilities such as clock
  server/    # backend/API
  web/       # frontend
configs/
  vitest/
```

## Setup Sequence

### 1. Package Foundation

1. Create `.node-version` — run `mise ls-remote node` and pick the latest even-numbered version.
2. Copy `package.json` → customize `name`, remove `private`/`license` per visibility.
3. Copy `pnpm-workspace.yaml` (root-level, even for single-package — catalogs require it). It must exist before the first install so `minimumReleaseAge`, `saveExact`, `allowBuilds`, etc. apply from the start.
4. Run `pnpm dlx corepack use pnpm@latest` to pin the exact `packageManager` hash (the template value may be stale; this replaces it). It also runs the first install and generates `pnpm-lock.yaml`.
5. Run `pnpm i` if the lockfile was not generated.

When the `pnpm` on PATH (e.g. from nixpkgs) is older than `packageManager`, pnpm switches itself to the pinned version and records it under `packageManagerDependencies` in `pnpm-lock.yaml`. This is expected; commit it.

Dependency build scripts are blocked unless listed in `allowBuilds` (pnpm fails with `ERR_PNPM_IGNORED_BUILDS`). The template allows `lefthook`; when another dependency needs its install script (e.g. `esbuild` once `tsx` is added), run `pnpm approve-builds <pkg>` or add it to `allowBuilds` yourself.

pnpm may also print "Agent skills awaiting approval" for packages that ship agent skills (e.g. `@tanstack/*`). Approving them (`pnpm approve`) is the user's decision — do not approve on their behalf.

Note: `.gitignore` and `LICENSE` are handled by `project-code/` pattern.

### 2. TypeScript

```bash
pnpm add -D typescript @tsconfig/strictest
```

Add type definitions based on project type:

- **Node.js backend**: `pnpm add -D @types/node`
- **React frontend**: `pnpm add -D @types/react @types/react-dom`
- **Fullstack**: `pnpm add -D @types/node @types/react @types/react-dom`

Add typecheck script to `package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc -p . --noEmit"
  }
}
```

**Single package**: Copy `tsconfig.json` to project root.

- `include` covers `src`, `configs`, and root `*.ts` (`vitest.config.ts`, `oxlint.config.ts`, `vite.config.ts`) so config files are type-checked too.
- `paths` maps `@/*` → `./src/*` (required by `shadcn-ui/`; harmless otherwise).
- `lib` keeps `dom` because the default shape is a fullstack single package. Only a backend-only package drops it (see `hono/`).
- Add `compilerOptions.types` per project: `["node"]` when Node APIs or `@types/node` are used, plus `"vite/client"` for Vite frontends (needed for `?url` imports). With React add `"jsx": "react-jsx"` (see `tanstack-start/`).

**Workspace**: Each package gets `tsconfig.json` with `composite: true` added. Root tsconfig is handled by the `workspace/` reference.

Preserve comments in tsconfig.json — they document why each option is set.

### 3. Linting & Formatting (oxc)

```bash
pnpm add -D oxlint oxlint-tsgolint oxfmt npm-run-all2
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "lint": "run-p lint:*",
    "lint:oxlint": "oxlint --ignore-path .gitignore --no-error-on-unmatched-pattern",
    "lint:oxfmt": "pnpm fix:oxfmt --check",
    "fix": "run-p fix:*",
    "fix:oxlint": "pnpm lint:oxlint --fix",
    "fix:oxfmt": "oxfmt --ignore-path .gitignore --no-error-on-unmatched-pattern"
  }
}
```

Copy `oxlint.config.ts`, `dev/lints/conventions.js` (see jsPlugins below), `lefthook.yml`, and `.oxfmtrc.json`.

Run `pnpm fix:oxfmt` once after copying and customizing the template files (and after `corepack use` / `pnpm add` edit `package.json`), so `pnpm lint:oxfmt` starts clean — `sortPackageJson` reorders keys added by hand or by tools.

oxfmt also formats Markdown. After adding or editing docs (hand-written tables in particular), run `pnpm fix:oxfmt` instead of adding docs to `ignorePatterns`.

Keep `--no-error-on-unmatched-pattern` on both `lint:oxlint` and `fix:oxfmt`. The lefthook pre-commit passes staged files explicitly, and when every staged file is excluded (JSON for oxlint, or paths in `ignorePatterns` such as `dev/**`), oxlint/oxfmt exit with an error and block the commit.

The oxlint template includes these architecture rules:

- global `Date` is prohibited outside `src/lib/clock.ts`; copy `src/lib/clock.ts`.
- frontend code cannot value-import backend code; type imports are limited to `server/**/models/**` contracts. Exception: `src/web/lib/api/client.ts` may type-import `RouteType` from `server/routes` for the Hono RPC client (its override reuses the `restrictedFrontendBackendValueImportPattern` constant).
- frontend feature code uses concrete API hooks under `src/web/apis/**`; direct `fetch` and direct `src/web/lib/api/client` usage are prohibited.
- `@testing-library/react`'s `renderHook` is prohibited; use `src/web/lib/test/renderHook` from the TanStack Start reference.
- `@tanstack/react-query`'s `useQuery` is prohibited by default; use Suspense-compatible query hooks unless a local exception is intentional.
- server `models/services` cannot value-import DB/repository/workflow modules.
- workflow value imports are allowed only from route/test boundaries.

These rules are intended for projects using the fullstack `hono/` + `tanstack-start/` shape. For frontend-only or backend-only projects, remove irrelevant overrides while keeping the `Date`/clock boundary.

#### jsPlugins (Custom Lint Rules)

The template `oxlint.config.ts` already wires `jsPlugins: ['./dev/lints/conventions.js']` and enables the `conventions/*` rules, so copy the plugin with it:

1. Copy `dev/lints/conventions.js`.
2. Its `MODULE_NAMES` / `ALLOWED_RUNTIME_DEPS` / `ALLOWED_TYPE_DEPS` match the single fullstack package shape above (`lib` ← `server`, `lib` ← `web`, `web` may type-import `server`). Customize them when the `src/` modules differ.
3. To opt out, remove `jsPlugins` and the `conventions/*` rules from `oxlint.config.ts` instead of leaving a dangling path.

Available rules in the conventions plugin:

- `no-barrel-file`: Prohibits `index.ts` files that only contain re-exports.
- `colocated-tests`: Requires test files to sit next to source, not in `__tests__/` directories.
- `module-boundaries`: Enforces dependency direction between `src/` modules.

### 4. Testing (Vitest)

```bash
pnpm add -D vitest happy-dom
# For React component / hook testing:
pnpm add -D @testing-library/react @testing-library/dom
```

Add test script to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

`vitest run` exits 1 when no test files exist, so the template ships `src/lib/clock.test.ts` (copy it with `src/lib/clock.ts`). Do not add `--passWithNoTests`; an empty suite in CI should be noticed.

Copy `vitest.config.ts` and setup files:

- `configs/vitest/time.setup.ts`
- `configs/vitest/db-required.setup.ts` when DB-required tests exist

Without a DB, delete the `db-required` project and its two `exclude` entries in `pure`, and skip `db-required.setup.ts`.

Default projects:

- `web-hooks`: `src/web/**/use*.test.{ts,tsx}` in `happy-dom`
- `pure`: regular pure/unit tests
- `db-required`: `src/server/**/workflows/**/*.test.{ts,tsx}` and `src/server/**/repositories/**/*.test.{ts,tsx}` with DB setup

If the project is frontend-only or backend-only, remove unused Vitest projects.

### 5. Clock Boundary

Copy `src/lib/clock.ts` and `src/lib/clock.test.ts`.

Use:

- `currentDate()` / `currentTimestamp()` in application code
- `dateFromIsoString()` for fixed dates
- `setFixedDateForTest()` or `setClockForTest()` in tests when needed

Do not use global `Date` directly outside the clock boundary.

### 6. Git Hooks (lefthook)

```bash
pnpm add -D lefthook
pnpm lefthook install
```

`lefthook` must be in `allowBuilds` (template `pnpm-workspace.yaml` already has it). Its own postinstall already runs `lefthook install` when the package is added, before `prepare` exists; that is harmless, and `pnpm lefthook install` is idempotent. Add the `prepare` script only now — the template `package.json` deliberately omits it, because `prepare` runs on every install and fails with `lefthook: command not found` before lefthook is installed.

```json
{
  "scripts": {
    "prepare": "lefthook install"
  }
}
```

### 7. CI (GitHub Actions)

Copy `.github/actions/setup-node/action.yml` and `.github/workflows/ci.yml` — customize steps per project needs.

For web apps, add Playwright browser install and E2E steps when `test:e2e` exists. For apps with D1 + Atlas, add `pnpm migrate:verify` (see `cloudflare-workers/`).

## Template Files

| File | Customize |
|------|-----------|
| `package.json` | `name`. Remove `private: true` for public / remove `license` for private |
| `pnpm-workspace.yaml` | Add packages to `allowBuilds` as needed (`pnpm approve-builds <pkg>`) |
| `tsconfig.json` | `include` paths. Add `types` (`node`, `vite/client`) and `jsx` per project |
| `oxlint.config.ts` | Remove irrelevant fullstack overrides per project type. `func-style` is off for TanStack route files (`**/app/**/page.tsx`) |
| `.oxfmtrc.json` | Ignore generated files and migration outputs as needed (`src/web/components/ui/**` and `src/web/hooks/use-mobile.ts` are ignored for shadcn output, matching oxlint) |
| `lefthook.yml` | None — use as-is unless hooks differ |
| `vitest.config.ts` | Remove unused projects per project type (`db-required` when there is no DB) |
| `configs/vitest/time.setup.ts` | None — use with `src/lib/clock.ts` |
| `configs/vitest/db-required.setup.ts` | DB setup env vars |
| `.github/actions/setup-node/action.yml` | Set the pnpm version to the one in `packageManager` after `corepack use` (template value may be stale) |
| `.github/workflows/ci.yml` | Add/remove steps |
| `dev/lints/conventions.js` | Module names, dependency directions (default: `lib` / `server` / `web`) |
| `src/lib/typedIncludes.ts` | None |
| `src/lib/controllablePromise.ts` | None — copy when needed |
| `src/lib/clock.ts` | None |
| `src/lib/clock.test.ts` | None — keeps `vitest run` from failing with "No test files found" |

## Common Utility Libraries

For TypeScript projects, copy utility files from `src/lib/` as needed:

| File | Description |
|------|-------------|
| `src/lib/clock.ts` | Injectable/testable clock boundary; global `Date` is prohibited elsewhere |
| `src/lib/typedIncludes.ts` | Type-safe `Array.includes()` — narrows the value type via type predicate |
| `src/lib/controllablePromise.ts` | Promise with externally accessible `resolve`/`reject`/`status` — useful for tests and coordination patterns |

## Editor Settings

### VSCode (`.vscode/settings.json`)

```json
{
  "js/ts.experimental.useTsgo": true,
  "js/ts.tsdk.path": "node_modules/typescript",
  "js/ts.preferences.importModuleSpecifier": "relative",
  "editor.tabSize": 2,
  "oxc.enable": true,
  "oxc.disableNestedConfig": false,
  "oxc.enable.oxfmt": true,
  "oxc.lint.run": "onType",
  "editor.formatOnSave": false,
  "[json][jsonc][typescript][typescriptreact][javascript][javascriptreact]": {
    "editor.defaultFormatter": "oxc.oxc-vscode",
    "editor.formatOnSave": true
  },
  "editor.codeActionsOnSave": {
    "source.fixAll.oxc": "explicit"
  }
}
```

TypeScript 7 ships no `tsserver`, so VS Code's built-in TypeScript support cannot use the workspace version. Recommend the "TypeScript 7" extension (`TypeScriptTeam.native-preview`) in `.vscode/extensions.json`; `js/ts.experimental.useTsgo` turns it on and `js/ts.tsdk.path` points it at the workspace package.

### Zed

Copy `.zed/settings.json`. Consolidates TypeScript language server + oxc + oxfmt settings.

The TypeScript language server is `typescript-ls` from the `tsgo` extension, which runs TypeScript 7's `tsc --lsp`. `vtsls` and `typescript-language-server` are disabled because TypeScript 7 ships no `tsserver` and they would fall back to their bundled TypeScript 5/6, duplicating diagnostics. Install the `tsgo` extension in Zed.
