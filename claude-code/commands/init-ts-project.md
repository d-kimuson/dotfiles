---
description: 'When to use: TypeScript プロジェクトを新規に初期化したいとき'
disable-model-invocation: true
user-invocable: true
allowed-tools: AskUserQuestion, Write, Edit, Bash(pnpm, git), Skill, Read
---

Initialize a new TypeScript project with industry best practices for type safety, code quality, and development workflow.

<workflow>

## Step 1: Load Required Skill

Activate the `ts-project-initialize` skill to access setup documentation and best practices.

## Step 2: Gather Project Requirements

Ask the user about project configuration:

1. **Project structure**: Single package or Monorepo (workspace)?
2. **Application types** (multiple selection allowed): Frontend (TanStack Router), Backend (Hono), UI Components (shadcn/ui), Library (no framework)
3. **Visibility**: Public (include LICENSE) or Private?

## Step 3: Execute Setup

Follow the setup sequence and configuration decisions documented in the ts-project-initialize skill. The skill defines the required order, dependencies, and best practices.

For each setup step, read the corresponding reference document from the skill directory (e.g., `claude-code/skills/ts-project-initialize/package.md`) and implement the documented approach.

## Step 4: Verify Installation

Run verification commands in sequence:
- `pnpm install` - Install all dependencies
- `pnpm typecheck` - Verify TypeScript configuration
- `pnpm lint` - Verify linting setup
- `pnpm build` - Test build process (skip if library-only project)

If any verification fails:
- Review error output carefully
- Fix issues in source files or configuration
- Re-run the failed command to confirm resolution
- If unresolvable, report the issue to the user with error details

</workflow>

<error_handling>

**Setup failures**:
- If `pnpm install` fails: Check network connectivity and lock file validity, report error to user
- If skill reference documents are missing: Report which document is missing and available alternatives
- If configuration conflicts occur: Consult the skill's setup sequence to verify dependencies are met

**Invalid selections**:
- Incompatible combinations are allowed (user may integrate them manually)
- If unclear, ask the user for clarification before proceeding

</error_handling>
