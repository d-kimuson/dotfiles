# TypeScript Package Setup

Complete setup for a TypeScript package: npm config, TypeScript, linting/formatting, testing, Git hooks, and CI.

## Directory Convention

- Entrypoint applications (frontend, backend, desktop, mobile, etc.) → `apps/${name}`
- Shared internal packages → `packages/${name}`

## Setup Sequence

### 1. Package Foundation

1. Create `.node-version` — run `mise ls-remote node` and pick the latest even-numbered version (e.g. 24)
2. Copy `package.json` → customize `name`, remove `private`/`license` per visibility
3. Run `pnpm dlx corepack use pnpm@latest` to pin the exact packageManager hash
4. Run `pnpm i` to generate lockfile
5. Copy `pnpm-workspace.yaml` (root-level, even for single-package — catalogs require it)

Note: `.gitignore` and `LICENSE` are handled by `core/` reference.

### 2. TypeScript

```bash
pnpm add -D @typescript/native-preview @tsconfig/strictest
```

Add type definitions based on project type:
- **Node.js backend**: `pnpm add -D @types/node`
- **React frontend**: `pnpm add -D @types/react @types/react-dom`
- **Fullstack**: `pnpm add -D @types/node @types/react @types/react-dom`

`@typescript/native-preview` provides `tsgo` — the native TypeScript type checker.

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
    "lint:oxlint": "oxlint --ignore-path .gitignore --no-error-on-unmatched-pattern",
    "lint:oxfmt": "pnpm fix:oxfmt --check",
    "fix": "run-p fix:*",
    "fix:oxlint": "pnpm lint:oxlint --fix",
    "fix:oxfmt": "oxfmt --ignore-path .gitignore --no-error-on-unmatched-pattern"
  }
}
```

Copy `oxlint.config.ts`, `.oxfmtrc.json`, `lefthook.yml` to project root.

- Remove unused plugins/rules from `oxlint.config.ts` per project type (e.g. drop `react`, `jsx-a11y` if no frontend)
- For workspaces, place these configs at workspace root
- Preserve all comments in `oxlint.config.ts`

### 4. Testing (vitest)

```bash
pnpm add -D vitest
# For browser-mode (frontend tests):
pnpm add -D @vitest/browser-playwright playwright
# For React component testing:
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

Copy `vitest.config.ts` to project root and configure based on project type:

**Fullstack (frontend + backend)**: Use the multi-project config as-is. Frontend tests (`src/web/**`) run in browser-mode via Playwright, everything else runs as normal unit tests.

**Frontend only**: Simplify to a single browser-mode project:

```typescript
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      headless: true,
    },
  },
});
```

**Backend / library only**: Simplify to a single project without browser-mode:

```typescript
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

### 5. Dev Tools

```bash
pnpm add -D lefthook
pnpm lefthook install
```

Add `prepare` script to `package.json`:

```json
{
  "scripts": {
    "prepare": "lefthook install"
  }
}
```

```bash
pnpm add -D gatecheck
pnpm gatecheck setup --non-interactive
```

### 6. CI (GitHub Actions)

Copy `setup-node-action.yml` to `.github/actions/setup-node/action.yml`.
Copy `ci.yml` to `.github/workflows/ci.yml` — customize steps per project needs.

## Template Files

| File | Customize |
|------|-----------|
| `package.json` | `name`. Remove `private: true` for public / remove `license` for private |
| `pnpm-workspace.yaml` | None — use as-is |
| `tsconfig.json` | `include` paths. Add `jsx: "preserve"` and `target: "ES2020"` for React |
| `oxlint.config.ts` | Remove unused plugins/rules per project type |
| `.oxfmtrc.json` | None — use as-is |
| `lefthook.yml` | None — use as-is |
| `vitest.config.ts` | Simplify per project type (see above) |
| `setup-node-action.yml` | None — copy to `.github/actions/setup-node/action.yml` |
| `ci.yml` | Add/remove steps — copy to `.github/workflows/ci.yml` |

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
