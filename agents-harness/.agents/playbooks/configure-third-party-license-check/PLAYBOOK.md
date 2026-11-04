---
name: configure-third-party-license-check
description: サードパーティライセンスの一覧生成とチェックを CI とリポジトリに組み込む
---

# Configure third party license check

Generate `THIRD_PARTY_LICENSES.md` from a package's production dependencies, commit it, and fail CI when a dependency's license is outside the allowlist or the committed file is stale. How an app serves the file is out of scope.

Templates are under `~/.agents/playbooks/configure-third-party-license-check/references/template/`; `template/<path>` is copied to `<path>` in the package.

## Step 1: Inspect the project

- pnpm is the package manager: the script reads `pnpm licenses list --prod --json`. Otherwise stop and ask.
- Target packages: each package that is published or deployed. In a workspace, every step below runs in that package's directory.
- The notice covers `dependencies` and their transitive dependencies. Everything the distribution contains at runtime must be in `dependencies`, and build-only tooling in `devDependencies`. Move misplaced packages (for example a Vite app's `react` in `devDependencies`). If a bundle has to inline devDependencies, report it to the user.
- The package's own license (`package.json#license`, `LICENSE`).

## Step 2: Add the script

Copy `scripts/third-party-licenses.ts`. Keep `ALLOWED` unless the package's license needs a narrower list. Never add a copyleft license (GPL, LGPL, AGPL, MPL, EPL, …) without the user's decision.

Add scripts:

```json
{
  "third-party:licenses": "node scripts/third-party-licenses.ts",
  "lint:third-party": "node scripts/third-party-licenses.ts --check"
}
```

`lint: run-p lint:*` picks up the check, so CI runs it with `pnpm lint`. Otherwise add `pnpm lint:third-party` to the CI job.

Exclude `THIRD_PARTY_LICENSES.md` from the formatter (`ignorePatterns` in `.oxfmtrc.json`), so formatting does not make it stale.

Regenerate the file when the lockfile changes, in `lefthook.yml`:

```yaml
pre-commit:
  commands:
    third-party-licenses:
      glob: 'pnpm-lock.yaml'
      run: pnpm third-party:licenses && git add THIRD_PARTY_LICENSES.md
```

In a workspace, run it with `pnpm --filter <package>` for each target package.

## Step 3: Generate and resolve failures

Run `pnpm third-party:licenses`.

- License outside the allowlist: replace the dependency, or ask the user. Add it to `EXCEPTIONS` only after reading its license, with the reason and the license found.
- No license text: find the license in the package's repository. If the license requires reproducing its text, report to the user instead of adding an exception.

## Step 4: Ship the file

If the package is published to npm, add `THIRD_PARTY_LICENSES.md` to `package.json#files` and confirm it with `pnpm pack --dry-run`.

## Step 5: Verify

```bash
pnpm third-party:licenses
pnpm lint:third-party
echo >> THIRD_PARTY_LICENSES.md && ! pnpm lint:third-party; pnpm third-party:licenses
pnpm lint
```

The third line confirms that a stale file fails the check, then restores it. Commit `THIRD_PARTY_LICENSES.md` with the setup.

## Step 6: Update the templates

Fix the template and this playbook for every step that did not apply as written (changed `pnpm licenses` output, license file layouts the script misses), keeping project-specific values out.
