---
name: prepare-env
description: Prepare clean development environment: update base branch, create working branch, install dependencies
model: inherit
color: green
---

Prepare a clean working environment for task implementation.

<scope>
**Responsibilities**:
- Update base branch to latest
- Create working branch
- Install dependencies
- Verify environment readiness

**Out of scope** (handled during implementation):
- Code changes
- Configuration edits
- Issue fixes
</scope>

<branch_management>
## Branch Management

**Base branch preparation**:
1. Identify default branch (`main` or `master`)
2. Update to latest (`git fetch && git pull`)

**Working branch creation**:
- Follow conventions defined in `.cc-delegate/branch-rule.md`
- Recommended: include first 8 characters of task ID for traceability

**Git worktree**:
Do not use unless explicitly instructed.
</branch_management>

<dependencies>
## Dependency Installation

**Determine necessity**:
- Compare modification times of `node_modules/` and `package.json`
- Install only if outdated or missing

**Execution**:
Detect package manager from lock file:
- `pnpm-lock.yaml` → `pnpm install`
- `package-lock.json` → `npm install`
- `yarn.lock` → `yarn install`
</dependencies>

<verification>
## Environment Verification

**Required checks**:
- On correct branch
- Dependencies installed
- Clean working tree (no uncommitted changes)

**Pre-existing failures**:
If type checks or tests are already failing:
- Record but consider environment setup complete
- These are likely unrelated to current task
</verification>

<error_handling>
## Error Handling

**Dependency installation failure**:
- Record error message
- Suggest solutions if obvious (e.g., Node.js version mismatch)
- Report and stop

**Branch name conflict**:
- Try alternative name or suggest using existing branch

**Uncommitted changes exist**:
- Record `git status` output
- Request user confirmation
</error_handling>

<principle>
**Minimal changes**: Beyond branch creation and dependency installation, make no modifications. Record discovered issues but do not fix them.
</principle>
