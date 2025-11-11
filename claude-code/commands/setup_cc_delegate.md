---
description: '/delegate コマンドに必要なプロジェクト固有ドキュメントをセットアップする'
allowed-tools: Read(*), Glob(*), Write(.cc-delegate/*), Bash(git)
---

<overview>
Set up project-specific documents required for the `/delegate` command workflow.

Read `~/.claude/commands/delegate.md` first to understand the overall context.

**Target files** (under `.cc-delegate/`):
1. `review-guideline.md`: Project-specific review criteria for reviewer agent
2. `branch-rule.md`: Branch naming conventions for prepare-env agent
</overview>

<file_handling_policy>
**For existing files**:
- Update rather than recreate
- Preserve existing structure and style
- Remove outdated entries (deprecated technologies, obsolete rules)
- Add missing perspectives

**For new files**:
- Create from scratch using templates below
</file_handling_policy>

<execution_process>

## Phase 1: Create `review-guideline.md`

<step_1 name="analyze_project_characteristics">

### Action
Gather information to understand project characteristics:

<investigation_targets>
**Technology stack**:
- Language and dependencies: `package.json`, `Cargo.toml`, `go.mod`, `requirements.txt`, etc.

**Implementation patterns**:
- Architecture patterns used in codebase
- Coding style conventions (variable naming, file organization, etc.)

**Existing documentation**:
- Guideline documents (coding standards, architecture docs, etc.)
- README files with development guidelines
</investigation_targets>

<tools>
Use Glob and Read tools to explore:
- Configuration files for tech stack identification
- Sample implementation files for style analysis
- Documentation files for existing guidelines
</tools>

</step_1>

<step_2 name="create_review_guideline_draft">

### Action
Create `.cc-delegate/review-guideline.md` based on project analysis.

<content_structure>
**Quality perspectives** (inferred from project):
- Type safety rules
- Test coverage requirements
- Performance considerations

**Tech-stack-specific rules**:
- Framework-specific best practices (e.g., React Hooks rules, TypeScript `any` prohibition)
- Library usage conventions

**Coding style**:
- Patterns observed in existing code
- Naming conventions, file organization

**References to existing docs** (if applicable):
- Link to detailed guidelines when they exist
- Use this file as an index/summary
- Keep content concise by delegating details to other docs
- Example: "For testing guidelines, see `docs/testing-guideline.md`"
</content_structure>

<template>
```markdown
# Code Review Guideline

Project-specific code review criteria.

## Type Safety
- Avoid `any`; use `unknown` with documented justification if unavoidable
- Prefer type guards over type assertions (`as`)

## Testing
See `docs/testing-guideline.md` for details.

- Add unit tests for new features
- Follow `*.test.ts` naming convention

## Architecture
- Separate business logic from presentation layer
- Maintain unidirectional dependencies

<!-- Customize based on project needs -->
```
</template>

<file_operation>
- **Existing file**: Read first, then update preserving structure
- **New file**: Create using template above
</file_operation>

</step_2>

## Phase 2: Create `branch-rule.md`

<step_3 name="analyze_existing_branches">

### Action
Investigate existing branch naming patterns.

<commands>
```bash
git branch -a --format='%(refname:short)' | grep -v '^origin$'
git log --oneline --all --decorate | grep -oP '\((.*?)\)' | head -20
```
</commands>

<analysis>
From command output, identify:
- Common branch prefixes (feature/, fix/, etc.)
- Temporary branch patterns (tmp, wip, etc.)
- Description format (kebab-case, snake_case, etc.)
</analysis>

</step_3>

<step_4 name="create_branch_rule_draft">

### Action
Create `.cc-delegate/branch-rule.md` based on observed patterns.

<template>
```markdown
# Branch Naming Rule

## Naming Convention

### Pattern

Regular branches: `<type>/<description>`
Temporary work branches: `tmp`, `wip`, etc.

### Types

- `feature/`: New feature development
- `fix/`: Bug fixes
- `refactor/`: Code refactoring
- `chore/`: Build process or tooling changes

### Examples

- `feature/add-user-authentication`
- `fix/resolve-memory-leak`
- `tmp` (temporary work)

<!-- Customize based on project needs -->
```
</template>

<file_operation>
- **Existing file**: Read first, then update preserving structure
- **New file**: Create using template above
</file_operation>

</step_4>

## Phase 3: User Review

<step_5 name="request_user_review">

### Action
After creating both files, request user review with the following message:

<review_request_message>
Created the following files:
- `.cc-delegate/review-guideline.md`
- `.cc-delegate/branch-rule.md`

Please review the content. Let me know if you'd like any additions or modifications.
If no changes needed, these are ready to use.
</review_request_message>

<feedback_handling>
- **If feedback provided**: Apply requested changes and confirm
- **If no feedback**: Consider setup complete
</feedback_handling>

</step_5>

</execution_process>

<completion_criteria>
**All of the following must be satisfied**:
- [ ] `.cc-delegate/review-guideline.md` exists with project-specific review criteria
- [ ] `.cc-delegate/branch-rule.md` exists with branch naming conventions
- [ ] References to existing docs are included (if applicable)
- [ ] User has reviewed and approved content
</completion_criteria>
