# TypeScript Package Setup

Complete setup for a TypeScript package: npm config, TypeScript, linting/formatting, testing, Git hooks, gatecheck, and CI.

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
3. Run `pnpm dlx corepack use pnpm@latest` to pin the exact packageManager hash.
4. Run `pnpm i` to generate lockfile.
5. Copy `pnpm-workspace.yaml` (root-level, even for single-package — catalogs require it).

Note: `.gitignore` and `LICENSE` are handled by `core/` reference.

### 2. TypeScript

```bash
pnpm add -D @typescript/native-preview @tsconfig/strictest
```

Add type definitions based on project type:

- **Node.js backend**: `pnpm add -D @types/node`
- **React frontend**: `pnpm add -D @types/react @types/react-dom`
- **Fullstack**: `pnpm add -D @types/node @types/react @types/react-dom`

Add typecheck script to `package.json`:

```json
{
  "scripts": {
    "typecheck": "tsgo -p . --noEmit"
  }
}
```

**Single package**: Copy `tsconfig.json` to project root.

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
    "lint:oxlint": "oxlint --ignore-path .gitignore",
    "lint:oxfmt": "pnpm fix:oxfmt --check",
    "fix": "run-p fix:*",
    "fix:oxlint": "pnpm lint:oxlint --fix",
    "fix:oxfmt": "oxfmt --ignore-path .gitignore --no-error-on-unmatched-pattern"
  }
}
```

Copy `oxlint.config.ts`, `.oxfmtrc.json`, `lefthook.yml` to project root.

The oxlint template includes these architecture rules:

- global `Date` is prohibited outside `src/lib/clock.ts`; copy `lib/clock.ts` to `src/lib/clock.ts`.
- frontend code cannot value-import backend code; type imports are limited to `server/**/models/**` contracts.
- frontend feature code uses concrete API hooks under `src/web/apis/**`; direct `fetch` and direct `src/web/lib/api/client` usage are prohibited.
- `@testing-library/react`'s `renderHook` is prohibited; use `src/web/lib/test/renderHook` from the TanStack Start reference.
- `@tanstack/react-query`'s `useQuery` is prohibited by default; use Suspense-compatible query hooks unless a local exception is intentional.
- server `models/services` cannot value-import DB/repository/workflow modules.
- workflow value imports are allowed only from route/test boundaries.

These rules are intended for projects using the fullstack `hono/` + `tanstack-start/` shape. For frontend-only or backend-only projects, remove irrelevant overrides while keeping the `Date`/clock boundary.

#### jsPlugins (Custom Lint Rules)

For projects with module boundaries or architectural conventions, set up custom oxlint JS plugins:

1. Create `dev/lints/` directory at project root.
2. Copy `conventions.js` to `dev/lints/conventions.js`.
3. Customize `MODULE_NAMES`, `ALLOWED_RUNTIME_DEPS`, `ALLOWED_TYPE_DEPS` for your project's module structure.
4. Add `jsPlugins` to `oxlint.config.ts` and enable desired `conventions/*` rules.

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

Copy `vitest.config.ts` to project root and copy setup files:

- `configs/vitest/time.setup.ts` → `configs/vitest/time.setup.ts`
- `configs/vitest/db-required.setup.ts` → `configs/vitest/db-required.setup.ts` when DB-required tests exist

Default projects:

- `web-hooks`: `src/web/**/use*.test.{ts,tsx}` in `happy-dom`
- `pure`: regular pure/unit tests
- `db-required`: `src/server/**/workflows/**/*.test.{ts,tsx}` and `src/server/**/repositories/**/*.test.{ts,tsx}` with DB setup

If the project is frontend-only or backend-only, remove unused Vitest projects.

### 5. Clock Boundary

Copy `lib/clock.ts` to `src/lib/clock.ts`.

Use:

- `currentDate()` / `currentTimestamp()` in application code
- `dateFromIsoString()` for fixed dates
- `setFixedDateForTest()` or `setClockForTest()` in tests when needed

Do not use global `Date` directly outside the clock boundary.

### 6. Dev Tools and Gatecheck

```bash
pnpm add -D lefthook gatecheck
pnpm lefthook install
pnpm gatecheck setup --non-interactive
```

Copy `gatecheck.yaml` to project root. If the setup command creates a different file, merge the template rules into it.

Add `prepare` script to `package.json`:

```json
{
  "scripts": {
    "prepare": "lefthook install"
  }
}
```

`gatecheck.yaml` should be the primary local quality gate and is referenced by `docs/CODING_PROCESS.md`.

### 7. CI (GitHub Actions)

Copy `setup-node-action.yml` to `.github/actions/setup-node/action.yml`.
Copy `ci.yml` to `.github/workflows/check.yaml` or `.github/workflows/ci.yml` — customize steps per project needs.

For web apps, add Playwright browser install and E2E steps when `test:e2e` exists. For apps with Drizzle/D1, add migration verification.

## Template Files

| File | Customize |
|------|-----------|
| `package.json` | `name`. Remove `private: true` for public / remove `license` for private |
| `pnpm-workspace.yaml` | None — use as-is |
| `tsconfig.json` | `include` paths. Add React/Node types per project |
| `oxlint.config.ts` | Remove irrelevant fullstack overrides per project type |
| `.oxfmtrc.json` | Ignore generated files and migration outputs as needed |
| `lefthook.yml` | None — use as-is unless hooks differ |
| `gatecheck.yaml` | Changed-file check commands |
| `vitest.config.ts` | Remove unused projects per project type |
| `configs/vitest/time.setup.ts` | None — use with `src/lib/clock.ts` |
| `configs/vitest/db-required.setup.ts` | DB setup env vars |
| `setup-node-action.yml` | Pin pnpm version if required |
| `ci.yml` | Add/remove steps — copy to `.github/workflows/check.yaml` or `ci.yml` |
| `conventions.js` | Module names, dependency directions — copy to `dev/lints/conventions.js` when used |
| `lib/typedIncludes.ts` | None — copy to `src/lib/typedIncludes.ts` |
| `lib/controllablePromise.ts` | None — copy to `src/lib/controllablePromise.ts` when needed |
| `lib/clock.ts` | None — copy to `src/lib/clock.ts` |

## Common Utility Libraries

For TypeScript projects, copy utility files from `lib/` to `src/lib/` as needed:

| File | Description |
|------|-------------|
| `lib/clock.ts` | Injectable/testable clock boundary; global `Date` is prohibited elsewhere |
| `lib/typedIncludes.ts` | Type-safe `Array.includes()` — narrows the value type via type predicate |
| `lib/controllablePromise.ts` | Promise with externally accessible `resolve`/`reject`/`status` — useful for tests and coordination patterns |

## Editor Settings

### VSCode (`.vscode/settings.json`)

```json
{
  "js/ts.tsdk.path": "node_modules/typescript/lib",
  "js/ts.tsdk.promptToUseWorkspaceVersion": true,
  "js/ts.experimental.useTsgo": true,
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

### Zed

Copy `zed-settings.json` to `.zed/settings.json`. Consolidates TypeScript language server (vtsls) + oxc + oxfmt settings.
