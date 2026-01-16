---
description: 'プロジェクト固有のガイドラインドキュメントをセットアップする'
allowed-tools: Read(*), Glob(*), Write(.kimuson/guidelines/*), Bash(git)
---

<overview>
Set up project-specific guideline documents based on codebase analysis and existing documentation.

**Target files** (under `.kimuson/guidelines/`):
1. `coding-guideline.md`: Coding standards discovered from project code
2. `qa-guideline.md`: Verification procedures tailored to this project
3. `branch-rule.md`: Branch naming conventions observed in repository
</overview>

<critical_principles>
**CRITICAL: Discovery-only, zero duplication**

- Document ONLY patterns found through codebase analysis (with evidence: file counts, examples)
- NEVER reference or duplicate CLAUDE.md (it's system context, already loaded in every session)
- NEVER include generic best practices (TypeScript basics, testing advice, framework patterns)
- If insufficient patterns found: Document gap for user input, don't invent rules

**Evidence requirement**:
- Pattern must appear in 3+ files to be "project convention"
- Cite file counts and example paths for each documented pattern
- ✅ "Variables: camelCase (observed in 87 files in src/)"
- ❌ "Variables should use camelCase" (generic, no evidence)
</critical_principles>

<responsibility_separation>
## Document Responsibilities

**coding-guideline.md** (Implementation phase):
- Rules to follow when writing code
- Type safety, naming conventions, architecture patterns
- References to existing documentation (when applicable)
- Test writing guidelines

**qa-guideline.md** (Verification phase):
- Exploratory QA procedures for LLM to follow
- How to start application (server commands, URLs)
- What functionality to verify manually (browser access, API calls)
- Expected behavior and success criteria

**branch-rule.md** (Environment setup phase):
- Branch naming conventions
- Temporary vs. permanent branch patterns
</responsibility_separation>

<file_handling>
**Standard pattern**: Existing file → Read first, Edit to update; New file → Write using template principles below
</file_handling>

<execution_process>

## Phase 1: Create `coding-guideline.md`

<step_1 name="systematic_codebase_analysis">

### Action
Systematically analyze the codebase to extract project-specific patterns. Think harder about what patterns are truly consistent across the project.

**Systematic analysis** (think harder about consistency):
1. **Structure discovery**: Glob for source files (`**/*.{ts,tsx}`, `**/*.test.*`)
2. **Sample 10-20 files**: Different modules, Read to analyze naming/structure/types
3. **Extract patterns**: Naming, file organization, type usage, testing, architecture
4. **Validate consistency**: Grep with `output_mode="count"` to verify pattern prevalence (3+ files = convention)
5. **Find docs**: Glob for `docs/**/*.md`, `**/CONTRIBUTING.md` (skip CLAUDE.md entirely)
6. **Large codebases**: Use Task tool with Explore agent if available

**If insufficient patterns**: Document gap for user input, don't invent generic rules

</step_1>

<step_2 name="create_coding_guideline_draft">

### Action
Create `.kimuson/guidelines/coding-guideline.md` from step_1 discoveries. Track sources internally (from docs/from code/gap) for Phase 4 confirmation.

**Template principles** (not prescribed structure - organize by discovered topics):
```markdown
# Coding Guideline

Project-specific patterns discovered from codebase analysis.

## [Topic Name - e.g., Naming Conventions, Type Usage, Testing]

- [Pattern]: [Description] (found in [N] files, e.g., src/components/*.tsx)
- [Another pattern with evidence]

## Documentation References

[Only if verified to exist:] For [topic]: See `path/to/doc.md`
```

**CRITICAL**: ALL content from step_1 discoveries. If no pattern found: Document gap, don't invent generic rules. Cite evidence (file counts, paths).

Apply <file_handling> pattern.

</step_2>

## Phase 2: Create `qa-guideline.md`

<step_3 name="create_qa_guideline_draft">

### Action
Create `.kimuson/guidelines/qa-guideline.md` from discovered configuration. Track sources for Phase 4.

**Discovery targets**:
- Startup commands: `package.json` scripts, README, docker-compose.yml, Makefile
- App type/endpoints: Web (port config), API (routes), CLI (commands)
- Verification targets: Code structure, test files, docs

**Template principles**:
```markdown
# QA Guideline

## Startup: [command from package.json/docs]
**Expected**: [output/URL from config]

## Verification: [Based on app type]
1. [Feature - from code/tests/docs]
2. [Verification method - browser/curl/CLI]

## Success Criteria: [Project-specific behaviors]
```

**CRITICAL**: Discover commands/URLs from config, don't assume. Document gaps if unclear.

Apply <file_handling> pattern.

</step_3>

## Phase 3: Create `branch-rule.md`

<step_4 name="analyze_and_create_branch_rule">

### Action
Analyze git history and create `.kimuson/guidelines/branch-rule.md`. Track sources for Phase 4.

```bash
git branch -a --format='%(refname:short)' | head -30
git log --oneline --all --decorate -20
```

**Analysis**: Identify branch prefixes (feature/, fix/), temporary patterns (tmp, wip), description format (kebab/snake case)

**Template principles**:
```markdown
# Branch Naming Rule

**Pattern**: [from git history] (found in [N] branches)
**Types**: [type1/, type2/] with counts
**Examples**: [actual branch names from log]
```

**CRITICAL**: If no clear pattern (few/inconsistent branches), document gap for user input.

Apply <file_handling> pattern.

</step_4>

## Phase 4: User Confirmation

<step_5 name="request_user_confirmation">

### Action
Present discovered patterns and gaps for confirmation. Skip items from verified project docs. NEVER mention system context files (CLAUDE.md, AGENTS.md).

**Message example**:
```
セットアップ完了しました。コードベース分析の結果:

**発見したパターン**:
- ファイル命名: kebab-case (src/ 配下 47 ファイルで確認)
- テストファイル: `*.test.ts` パターン (23 ファイル)
- 起動コマンド: `npm run dev` (package.json より)
- ブランチタイプ: feature/, fix/ (git log で 18 ブランチ確認)

**パターンが見つからなかった項目**:
- 変数命名規則 (一貫性なし - 好みを指定してください)

パターンは正しいですか? 不明な項目への方針があれば教えてください。
```

Apply user feedback if provided, or consider complete if "OK"/no feedback.

</step_5>

</execution_process>

<completion_criteria>
All three guideline files exist with:
- Discovered patterns (not generic advice) with evidence citations
- Project-specific content (zero generic best practices)
- No CLAUDE.md duplication (context files skipped)
- User confirmation of patterns and input for gaps
</completion_criteria>
