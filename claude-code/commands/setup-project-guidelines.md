---
description: 'プロジェクト固有のガイドラインドキュメントをセットアップする'
allowed-tools: Read(*), Glob(*), Write(.kimuson/guidelines/*), Bash(git)
---

<overview>
Set up project-specific guideline documents.

**Target files** (under `.kimuson/guidelines/`):
1. `coding-guideline.md`: Coding standards and best practices for implementation
2. `qa-guideline.md`: Verification procedures for LLM-driven testing
3. `branch-rule.md`: Branch naming conventions for prepare-env agent
</overview>

<responsibility_separation>
## Document Responsibilities

**coding-guideline.md** (Implementation phase):
- Rules to follow when writing code
- Type safety, naming conventions, architecture patterns
- References to existing documentation (when applicable)
- Test writing guidelines
- Reviewer agent uses this guideline along with general review perspectives

**qa-guideline.md** (Verification phase):
- Exploratory QA procedures for LLM to follow
- How to start application (server commands, URLs)
- What functionality to verify manually (browser access, API calls)
- Expected behavior and success criteria

**branch-rule.md** (Environment setup phase):
- Branch naming conventions
- Temporary vs. permanent branch patterns
</responsibility_separation>

<writing_guidelines>
## Guideline Writing Best Practices

Apply prompt engineering principles to create effective, concise guidelines.

<conciseness>
### Keep Guidelines Concise

**Focus on essential information**:
- Rules and constraints, not detailed procedures
- Trust the LLM to infer implementation details
- Remove redundant explanations
- Aim for clarity over completeness

**Red flags** (avoid in guidelines):
- Step-by-step procedures (LLM can infer these)
- Multiple language examples (pick project's primary language)
- Hypothetical file paths (only reference verified files)
- Generic patterns (should be in CLAUDE.md if project-wide)
</conciseness>

<documentation_references>
### Referencing Existing Documentation

**When to reference vs. inline**:
- **Small, concise docs** (< 50 lines): OK to reference by file path only
  - Example: "Follow patterns in `docs/testing.md`"
  - LLM will read and apply the document
- **Large docs or partial relevance**: Summarize key points, reference for details
  - Extract essential rules into guideline
  - Reference original doc for comprehensive coverage
- **Always verify**: Only reference files that actually exist (use Read/Glob)

**Benefits of file references**:
- Reduces duplication and maintenance burden
- Guidelines stay focused and readable
- Changes to source docs automatically propagate
</documentation_references>

<structure>
### Structure and Clarity

**Use XML tags for organization**:
- Group related rules within clear sections
- Recommended tags: `<rules>`, `<examples>`, `<antipatterns>`
- Improves LLM comprehension and adherence

**High cohesion**:
- Keep related information together
- Don't scatter rules across multiple sections
- Group by topic, not by severity or type
</structure>

<specificity>
### Be Specific and Concrete

**Avoid ambiguity**:
- Use concrete examples over abstract descriptions
- Define clear success criteria
- Specify exact commands when applicable

**Good**:
```markdown
## Type Safety
- Avoid `any`; use `unknown` with type guards if needed
- Prefer union types over optional properties when state is mutually exclusive
```

**Avoid**:
```markdown
## Type Safety
- Use TypeScript properly
- Make sure types are safe
```
</specificity>
</writing_guidelines>

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

## Phase 1: Create `coding-guideline.md`

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

<step_2 name="create_coding_guideline_draft">

### Action
Create `.kimuson/guidelines/coding-guideline.md` based on project analysis.

<tracking_requirement>
**Track inference sources**:
- **From existing docs**: Guidelines found in documentation files (e.g., `docs/*.md` or other .md files)
- **Inferred from codebase**: Patterns observed in code (naming, structure, etc.)
- **No documentation found**: Items created from general best practices

Keep internal notes to distinguish these for user confirmation.
</tracking_requirement>

<content_structure>
**Core coding rules**:
- Type safety requirements
- Naming conventions (variables, functions, files)
- Architecture patterns to follow

**Tech-stack-specific practices**:
- Framework-specific best practices (e.g., React Hooks rules)
- Language idioms (e.g., TypeScript `any` prohibition)
- Library usage patterns

**Test guidelines**:
- When to write tests
- Test naming conventions
- Test structure patterns

**Documentation references** (if applicable):
- Reference existing documentation files when they contain relevant guidelines
- Use this file as an index/summary when detailed docs exist elsewhere
- **Important**: Only reference documents that actually exist (verified via Read/Glob)
- Example: "For testing patterns, see `docs/testing.md`" (only if verified to exist)
</content_structure>

<template>
```markdown
# Coding Guideline

Project-specific coding standards and best practices.

## Type Safety

- Avoid `any`; use `unknown` with documented justification if unavoidable
- Prefer type guards over type assertions (`as`)
- Ensure all function parameters and return values have explicit types

## Naming Conventions

- Variables: camelCase
- Files: kebab-case for modules, PascalCase for components
- Constants: UPPER_SNAKE_CASE for true constants

## Architecture

- Separate business logic from presentation layer
- Maintain unidirectional dependencies
- Follow existing directory structure

## Testing

- Write unit tests for new features
- Follow `*.test.ts` naming convention
- Test both happy paths and error cases

<!-- Customize based on project needs -->
```
</template>

<file_operation>
- **Existing file**: Read first, then update preserving structure
- **New file**: Create using template above
</file_operation>

</step_2>

## Phase 2: Create `qa-guideline.md`

<step_3 name="create_qa_guideline_draft">

### Action
Create `.kimuson/guidelines/qa-guideline.md` with exploratory QA procedures for LLM.

<tracking_requirement>
Track inference sources (same as step_2) for user confirmation.
</tracking_requirement>

<content_structure>
**Application startup**:
- Commands to start the application (dev server, API server, etc.)
- Expected startup time and success indicators
- URLs and ports to access

**Manual verification steps**:
- What functionality to verify (login, data display, API endpoints, etc.)
- How to verify (browser access, curl commands, CLI execution)
- Expected behavior and success criteria

**Error checking**:
- Where to look for errors (browser console, server logs)
- Common issues and how to identify them

**Important**: Write for LLM exploratory testing, not automated test execution
- Describe manual verification procedures
- Specify what to observe and how to interact
- Define expected vs. actual behavior
</content_structure>

<template>
```markdown
# QA Guideline

Exploratory QA procedures for LLM to verify functionality manually.

## Web Application Verification

**Start development server**:
```bash
pnpm dev
```

**Wait for**: Server logs "ready on http://localhost:3000" (typically 10-30 seconds)

**Verification steps**:
1. Access http://localhost:3000 in browser
2. Verify home page loads without errors
3. Test login functionality:
   - Navigate to /login
   - Enter test credentials (user@example.com / password123)
   - Verify redirect to dashboard on success
4. Check dashboard displays data correctly
5. Verify no console errors in browser DevTools

**Success criteria**:
- All pages load successfully
- Login flow works end-to-end
- No JavaScript errors in console
- No 404 or 500 errors in network tab

**Cleanup**: Stop dev server after verification

## API Verification (Alternative)

**Start API server**:
```bash
pnpm start:api
```

**Wait for**: "API server listening on port 3000"

**Verification steps**:
1. Test health endpoint:
```bash
curl http://localhost:3000/health
# Expected: {"status": "ok"}
```

2. Test authentication:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123"}'
# Expected: 200 status with token
```

3. Test protected endpoint:
```bash
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer <token>"
# Expected: 200 status with user list
```

**Success criteria**:
- All endpoints return expected status codes
- Response payloads match expected structure
- No server errors in logs

**Cleanup**: Stop API server after verification

<!-- Customize based on project type and features -->
```
</template>

<file_operation>
- **Existing file**: Read first, then update preserving structure
- **New file**: Create using template above
</file_operation>

</step_3>

## Phase 3: Create `branch-rule.md`

<step_4 name="analyze_existing_branches">

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

</step_4>

<step_5 name="create_branch_rule_draft">

### Action
Create `.kimuson/guidelines/branch-rule.md` based on observed patterns.

<tracking_requirement>
Track inference sources (same as step_2) for user confirmation.
</tracking_requirement>

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

</step_5>

## Phase 4: User Confirmation

<step_6 name="request_user_confirmation">

### Action
After creating all files, present **only inferred items** for user confirmation.

<confirmation_strategy>
**Focus on uncertainty only**:
- List items inferred from codebase patterns (no explicit documentation)
- List items created from general best practices (no project-specific info found)
- **Skip items** referenced from existing docs (CLAUDE.md, CONTRIBUTING.md, etc.)

**Message structure**:
1. Brief summary: "Created 4 guideline files"
2. **Inferred items requiring confirmation** (bulleted list, grouped by file)
3. Ask: "Do these look correct for your project?"
</confirmation_strategy>

<message_template>
**Example confirmation message**:

```
セットアップ完了しました。以下の項目はドキュメントが見つからなかったため推測で作成しています。確認をお願いします:

**coding-guideline.md**:
- TypeScript の `any` 禁止ルール
- テストファイル命名規則: `*.test.ts`

**qa-guideline.md**:
- 開発サーバー起動コマンド: `pnpm dev`
- アクセスURL: http://localhost:3000

**branch-rule.md**:
- ブランチプレフィックス: `feature/`, `fix/`, `refactor/`

これらで問題なければそのまま使えます。修正が必要な箇所があれば教えてください。
```

**If nothing was inferred** (all from existing docs):
```
セットアップ完了しました。既存のドキュメントから必要な情報を収集できたため、すぐに使えます。
```
</message_template>

<feedback_handling>
- **If feedback provided**: Apply requested changes and confirm
- **If no feedback or "OK"**: Consider setup complete
</feedback_handling>

</step_6>

</execution_process>

<completion_criteria>
**All of the following must be satisfied**:
- [ ] `.kimuson/guidelines/coding-guideline.md` exists with project-specific coding standards
- [ ] `.kimuson/guidelines/qa-guideline.md` exists with LLM-driven verification procedures
- [ ] `.kimuson/guidelines/branch-rule.md` exists with branch naming conventions
- [ ] References to existing docs are included (if applicable)
- [ ] User has confirmed inferred items (or no inference was needed)
</completion_criteria>
