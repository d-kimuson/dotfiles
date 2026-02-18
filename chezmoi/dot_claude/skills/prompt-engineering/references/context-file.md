# Context Files Detailed Reference

## Overview
Project-wide or global context that is automatically loaded every session, such as CLAUDE.md, GEMINI.md, AGENTS.md, etc.

## File Structure
- **Location**:
  - Project: `.claude/CLAUDE.md`, `.gemini/GEMINI.md`, `.claude/AGENTS.md`
  - Global: `~/.claude/CLAUDE.md`, `~/.gemini/GEMINI.md`, `~/.claude/AGENTS.md`
- **Processing**: Entire content is injected into the base context every session
- **No frontmatter**: Write content directly

## Key Characteristics
- **Always loaded**: Loaded every session regardless of the task
- **Maximum cost**: Consumes context tokens on every interaction
- **Minimal content**: Include only what 80% of tasks need

> **Note**: These are guidelines, not absolute rules. Exceptions may be justified depending on project-specific circumstances. Use judgment, and default to minimalism when uncertain.

## Content Principles

### 1. Index First
Pointers to detailed documentation, not comprehensive content.
- ✅ "Coding conventions: docs/coding-style.md"
- Write content directly only when: undiscoverable, affects all tasks, and extremely concise (1-2 lines)

### 2. 80% Rule
Only information that 80% of tasks need.
- ✅ Repository structure, key conventions, important constraints

### 3. Abstract and Navigational
Material for finding information, not detailed listings.
- ✅ "Database: alembic files are in db/migrations/"

### 4. Scrutinize Commands
Only commands that the LLM will autonomously execute during typical tasks.
- ✅ `pnpm build`, `pnpm test` (executed by LLM)

## Good Example
```markdown
# CLAUDE.md (my-project)

## Architecture
- Monorepo: pnpm workspaces
- API: packages/api (NestJS), Frontend: packages/web (Next.js)
- Details: docs/architecture/README.md

## Key Conventions
- Branch naming: feature/*, bugfix/* (docs/git-workflow.md)
- Never modify: src/generated/* (auto-generated)
- Testing: Vitest/Playwright (docs/testing.md)

## Critical Constraints
- Database changes require migration (alembic)
- Public API changes require version bump (semver)
```
