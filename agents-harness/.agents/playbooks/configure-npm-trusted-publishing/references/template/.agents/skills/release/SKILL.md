---
name: release
description: Run the <package-name> release flow end-to-end. Use when the user asks to release patch, minor, major, beta, or an explicit semver; bumps the version with `npm version`, pushes the signed tag, watches the Release workflow that publishes to npm, and publishes the GitHub Release.
metadata:
  internal: true
---

# <package-name> Release

A release is a version of the npm package `<package-name>`, built from a signed `v<version>` tag by `.github/workflows/release.yml` and published with Trusted Publishing (OIDC). No npm token exists anywhere. A published version is never changed: a fix is a new version.

## Inputs

Interpret the user's argument as the release version spec:

| Spec                        | `npm version` argument    | Example                                           |
| --------------------------- | ------------------------- | ------------------------------------------------- |
| `patch` / `minor` / `major` | the same                  | `0.1.0` → `0.1.1`; `0.1.1-beta.2` → `0.1.1`       |
| `beta`                      | `prerelease --preid beta` | `0.1.0` → `0.1.1-beta.0`; `…-beta.0` → `…-beta.1` |
| an explicit semver          | the version               | `0.2.0`, `0.2.0-beta.0`                           |

If no version spec is present, ask the user which one to use. A prerelease goes to the dist-tag of its identifier (`beta`), so `@latest` is untouched.

## Preconditions

1. Work from the repository root on `main`, with a clean working tree. If there are unrelated uncommitted changes, stop and ask the user how to handle them; `npm version` refuses a dirty tree.

```bash
git branch --show-current
git status --short
```

2. The commit and the tag are signed:

```bash
git config --get commit.gpgsign # true
git config --get tag.gpgsign    # true
```

3. The npm package exists and has a trusted publisher for `release.yml`. The first version is published by hand, because npm cannot configure a trusted publisher for a package that does not exist yet.

## Release command

```bash
npm version <argument> -m "chore: release v%s"
git push --follow-tags
```

`npm version` runs the `preversion` script first (dependency audit, lint, typecheck, test, build), then updates `package.json`, creates the signed commit `chore: release v<version>` and the signed annotated tag `v<version>`. If a check fails, nothing is committed or tagged; fix it in a normal commit and run `npm version` again.

If the push fails, the commit and the tag already exist locally. Fix the cause and push again; do not rerun `npm version`.

## Monitor GitHub Actions

The tag triggers the Release workflow. It audits the dependencies, checks the tag names the version in `package.json`, builds, strips the development fields (`clean-pkg-json`) and publishes under the dist-tag of the version.

```bash
TAG="v0.0.0" # replace
RUN_ID="$(gh run list --workflow Release --limit 20 --json databaseId,headBranch,event --jq ".[] | select(.headBranch == \"$TAG\" and .event == \"push\") | .databaseId" | head -n 1)"
test -n "$RUN_ID" && gh run watch "$RUN_ID" --exit-status
gh run view "$RUN_ID" --log-failed   # when it fails
```

A version npm has not published can be retried by rerunning the workflow. Once npm has it, the number is spent: release the fix as the next version.

## Verify publish

```bash
VERSION="0.0.0" # replace, without the leading v
npm view "<package-name>@$VERSION" version
npm dist-tag ls <package-name>
npm view "<package-name>@$VERSION" dist.attestations
```

The dist-tag list must show the version under `latest` (or under its prerelease identifier). With a public repository, `dist.attestations` is present; the manual first publish has none.

## GitHub Release

Create the release from the tag with generated notes as a draft, then rewrite the notes:

```bash
TAG="v0.0.0" # replace
gh release create "$TAG" --verify-tag --draft --generate-notes $([[ "$TAG" == *-* ]] && echo --prerelease)
gh release view "$TAG" --json body --jq .body
```

Rewrite the notes for the package's users: concise English; the sections `Features`, `Bug Fixes` and `Breaking Changes` when they apply; the impact on a consumer rather than implementation detail; drop formatting-only, dependency-only and internal items. Publish the draft:

```bash
NOTES_FILE="$TMPDIR/<package-name>-$TAG-release-notes.md" # write it with the file tool
gh release edit "$TAG" --notes-file "$NOTES_FILE" --draft=false
gh release view "$TAG" --json tagName,isDraft,isPrerelease,url
```

## When it fails

| Symptom                                           | Cause and fix                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Audit dependencies` fails                        | Update the vulnerable package. If no fix exists and the advisory does not apply, ask the user before adding `--ignore <GHSA>` to `audit:deps`. |
| `tag v… does not match package.json version …`    | Nothing was published; delete the wrong tag (`git push origin :v<wrong>`) and tag again.                                              |
| `ENEEDAUTH` or `Unable to authenticate`           | The workflow filename, repository or `repository.url` does not match the trusted publisher on npmjs.com.                              |
| `403`, or the publish is not authenticated at all | The configuration expired (no OIDC publish within 2 days) or `id-token: write` is missing. Ask the owner to recreate the configuration. |
| `EPUBLISHCONFLICT` / `cannot publish over …`      | The version is already on npm. Never reuse the number; release the next version.                                                      |

## Final report

- released tag/version and its npm dist-tag
- the `npm version` command used
- GitHub Actions run ID and result
- npm verification results
- GitHub Release URL and draft/public state
