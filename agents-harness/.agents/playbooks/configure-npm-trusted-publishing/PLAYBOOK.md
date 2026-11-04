---
name: configure-npm-trusted-publishing
description: npm パッケージを trusted publishing で公開する仕組み（監査と minimumReleaseAge を含む）を整える
---

# Configure npm trusted publishing

Publish an npm package from a signed `v<version>` tag through GitHub Actions with Trusted Publishing (OIDC), with no npm token anywhere. A dependency audit gates every release, and a project `release` skill runs the flow.

Templates are under `~/.agents/playbooks/configure-npm-trusted-publishing/references/template/`; `template/<path>` is copied to `<path>` in the repository.

## Step 1: Inspect the project

Confirm and collect, asking the user only for what the repository does not answer:

- pnpm is the package manager and the repository is on GitHub. Otherwise stop and ask.
- The package to publish and its npm name. Scoped names publish as public.
- Whether the package already exists on npm (`npm view <package-name> version`). If it does not, the first version is published by hand (Step 5).
- Whether the GitHub repository is public. Provenance is generated only for a public package from a public repository.
- The Node version in `.node-version`: Trusted Publishing needs Node 22.14.0 or later and npm 11.5.1 or later. The workflow checks the bundled npm before publishing.
- Existing publish workflows, `NPM_TOKEN` secrets and `.npmrc` tokens. Remove them in Step 3; report a secret to the user, since only the owner can delete it.

## Step 2: Package and dependency settings

`package.json`:

- Remove `private`. For a new package, set `version` to `0.0.0`.
- `repository.url`: exactly `git+https://github.com/<owner>/<repo>.git`. npm compares it with the trusted publisher on every publish. Set `homepage` and `bugs` to the same repository.
- `files`: only what consumers need (build output, user docs, `THIRD_PARTY_LICENSES.md` when present). npm adds `package.json`, `README.md` and `LICENSE`.
- `publishConfig`: `{ "access": "public" }`. Do not add `provenance`; npm generates it for an OIDC publish from a public repository.
- Add `clean-pkg-json` as an exact devDependency.
- Scripts:

```json
{
  "audit:deps": "pnpm audit --audit-level high",
  "preversion": "pnpm audit:deps && pnpm lint && pnpm typecheck && pnpm test && pnpm build"
}
```

Adapt `preversion` to the scripts the project has. If `pnpm audit:deps` fails, update the vulnerable packages. If an advisory has no fix and does not apply, ask the user before appending `--ignore <GHSA>` to `audit:deps`.

`pnpm-workspace.yaml` must keep these (add any that are missing):

```yaml
engineStrict: true
saveExact: true
minimumReleaseAge: 1440
```

## Step 3: Release workflow

Copy `.github/workflows/release.yml`. Keep the filename: npm's trusted publisher names it. Customize only the job steps the project needs differently (for example the build command). Keep `--ignore-scripts`, the audit step, the tag/version check, the npm version check and `clean-pkg-json`.

Remove token-based publish steps and `.npmrc` tokens found in Step 1.

## Step 4: Release skill

Copy `.agents/skills/release/SKILL.md` and replace `<package-name>`. Adjust the Verify section to how consumers load the package (for example a CDN URL). If the repository exposes skills through `.claude/skills`, make sure the new skill is reachable there.

## Step 5: Hand the owner steps to the user

These need the owner's npm account; do not run `npm login` or `npm publish`. Give the user these steps with the values filled in:

1. **First version (new package only).** From a clean checkout of the release commit:

   ```bash
   pnpm install --frozen-lockfile
   pnpm build && pnpm exec clean-pkg-json
   npm pack --dry-run --ignore-scripts
   npm login
   npm publish --access public --tag latest
   git restore package.json
   ```

   Do not push a tag for this version; the first tag names the next version.

2. **Trusted publisher.** npmjs.com → the package → Settings → Trusted publishing → GitHub Actions. Fields are case-sensitive and validated only when a publish arrives:

   | Field                | Value         |
   | -------------------- | ------------- |
   | Organization or user | `<owner>`     |
   | Repository           | `<repo>`      |
   | Workflow filename    | `release.yml` |
   | Environment name     | (empty)       |

3. **Publish through the workflow within 2 days.** An unused configuration expires and has to be recreated. Run the `release` skill with `patch`.

4. **Disallow tokens.** Settings → Publishing access → "Require two-factor authentication and disallow tokens".

## Step 6: Verify

```bash
pnpm audit:deps
pnpm build
npm pack --dry-run --ignore-scripts
```

The pack list must contain only the intended files. Validate the workflow with `actionlint` when available. Do not push a tag to test the workflow; the first release through the skill is the end-to-end check.

If the package ships its dependencies' code (a bundle) and has no third-party notice, suggest the `configure-third-party-license-check` playbook to the user.

## Step 7: Update the templates

Fix the templates and this playbook for every step that did not apply as written (changed npm requirements, action versions, failures), keeping project-specific values out.
