---
name: github
description: GitHubと連携した作業を効率的に行うためのスキル
---

## gh cli の利用

Do not use WebFetch for GitHub URLs provided by users, as they often require authentication.
Use gh and git commands instead:

- Check file contents:
  - `curl "$(gh api 'repos/<owner>/<repo>/contents/path/to/file.txt?ref=<ref>' | jq -r '.download_url')"`
- Check PR contents:
  - `gh pr view <pr_number> --json title,body,headRefName,commits`
- ...etc

## Draft PR の作成

Create draft pull request following this systematic process.

<preparation>
### 1. Understand Current State

**Identify branches**:
```bash
# Current branch
git rev-parse --abbrev-ref HEAD

# Base branch from recent checkouts
git reflog -n 30 | grep 'checkout'
```

**Review changes**:
```bash
# Compare with base branch
git diff <base-branch>...HEAD --stat
git log <base-branch>..HEAD --oneline

# Check for uncommitted changes
git status
```

Skip these commands if you already understand the changes from current workflow context.
</preparation>

<commits>
### 2. Commit Management

**If uncommitted changes exist**:
- Split into reviewer-friendly commits (logical units)
- Follow project commit message conventions (check `git log` for style)
- Each commit should be self-contained and understandable

**If no uncommitted changes**:
Skip this step.
</commits>

<push>
### 3. Push to Remote

```bash
git push -u origin HEAD
```

**Handle push failures**:
- Conflict with remote → `git pull --rebase` and retry
- Permission error → Report to user
</push>

<pr_creation>
### 4. Create Pull Request

**Check for PR template**:
```bash
cat $(git rev-parse --show-toplevel)/.github/pull_request_template.md
```

**Fill PR body**:

If template exists:
- Fill each section based on template structure
- Testing section should include:
  - User actions required for verification
  - "CI Pass" item
  - Manual verification performed (e.g., "Ran build script", "Tested feature X")

If no template exists:
```markdown
## Summary
[Task overview and context]

## Changes
- [Change 1]
- [Change 2]

## Testing
- [ ] CI Pass
- [ ] Static analysis passed
- [ ] [Other manual verification if performed]
```

**Create draft PR**:
```bash
gh pr create --draft --base <base-branch> --title "..." --body "..."
```

**Fallback if draft unsupported**:
Remove `--draft` flag and create as regular PR.
</pr_creation>

<verification>
### 5. Verification

**Check authentication**:
```bash
gh auth status
```

**Confirm base branch**:
If reflog doesn't clearly show base branch, ask user for confirmation instead of guessing.
</verification>

<pr_principles>
### Principles

**PR is communication**:
Clear, understandable explanation for reviewers. Convey "why this change is needed" and "what was changed".

**Base branch accuracy is critical**:
PR to wrong base branch causes serious issues. Verify carefully from reflog or ask for confirmation.

**Commit granularity matters**:
Each commit should tell a story. Split logically, not arbitrarily.
</pr_principles>

## PR の CI チェック

タスクの完了条件としてPRのCI監視と結果を確認する必要がある場合は専用のスクリプトを実行することで待機とレポートを受け取ります。

```bash
<skills-directory>/scripts/wait-pr-checks-and-report.sh <PR_NUMBER>
```
