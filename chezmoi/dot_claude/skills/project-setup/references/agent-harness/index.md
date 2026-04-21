# Agent Harness

Set up coding agent context files (CLAUDE.md / AGENTS.md) and project convention documents.

## Generated Files

| File | Location | When Referenced |
|------|----------|----------------|
| `CLAUDE.md` | Project root | Entry point — `@AGENTS.md` reference only |
| `AGENTS.md` | Project root | Always loaded — architecture overview + reference pointers |
| `coding-guideline.md` | `docs/` | When making design decisions |
| `coding-process.md` | `docs/` | When starting implementation work (includes Definition of Done) |
| `commit_message.md` | `docs/` | When creating commits |
| `branch_naming.md` | `docs/` | When creating branches |
| `e2e-exploratory-testing-process.md` | `docs/` | E2E exploratory testing (delegate to QA subagent) |

## Procedure

### 1. Determine Output Directory

Check for existing docs directory (`docs/`, etc.). Default to `docs/`.

### 2. Create CLAUDE.md + AGENTS.md

Create `CLAUDE.md` from `CLAUDE.md` template — this is just `@AGENTS.md`.

Create `AGENTS.md` from `AGENTS.md` template. Analyze the project to fill in:

- **Architecture**: What the project does, high-level request/data flow as ASCII diagram, key architectural decisions (2-3 bullet points)
- **Reference**: Pointers to all generated docs files

AGENTS.md must be concise — it is always loaded. Only include overview and references. All details go in referenced docs.

### 3. Coding Guideline

Use `coding-guideline.md` template as a starting point. Analyze the codebase to identify:

- Design patterns actually used (ADT, functional style, OOP, etc.)
- Module organization conventions (file suffixes like `*.pure.ts`, `*.service.ts`)
- Directory structure philosophy (collocated tests, feature-based, layer-based)

Customize based on actual patterns found. Remove sections that don't apply, add project-specific philosophies.

### 4. Coding Process + Definition of Done

Use `coding-process.md` template as a starting point. Investigate:

- Available check commands (`pnpm gatecheck check`, `pnpm typecheck`, `pnpm lint`, etc.)
- Build and deployment commands
- Project-specific workflows (fixture updates, code generation, etc.)

Definition of Done is a section within coding-process.md. Base it on `pnpm gatecheck check` and add any checks not covered by gatecheck.

### 5. Commit Message Conventions

Use `commit_message.md` template as a starting point.

Run `git log --oneline -50` and analyze:
- **Prefix**: Conventional Commits (`feat:`, `fix:`, `chore:`) or custom?
- **Scope**: `feat(api):` style scoping?
- **Format**: Language, tense, capitalization
- **Other**: Issue reference format (`#123`, `PROJ-123`)

Customize the template with Good/Bad examples from actual history.

### 6. Branch Naming Conventions

Run `git branch -a` and analyze:
- **Prefix**: `feature/`, `fix/`, `hotfix/`
- **Separator**: `/`, `-`, `_`
- **Pattern**: `feature/issue-123-description`, `fix/short-desc`

Generate `branch_naming.md` with examples.

### 7. E2E Exploratory Testing Process

Choose template based on project type:

| Project Type | Template |
|-------------|----------|
| Web application (frontend, fullstack) | `e2e-exploratory-testing-process.web.md` |
| API application (backend only) | `e2e-exploratory-testing-process.api.md` |

For fullstack apps, use `e2e-exploratory-testing-process.web.md` (covers both browser and API testing).

Investigate dev server commands, ports, and project-specific testing notes.

## Cross-Agent CLI Compatibility

`CLAUDE.md` uses `@AGENTS.md` to delegate content, making `AGENTS.md` the single source of truth.
Other agent CLIs (Codex, Copilot CLI, Cursor CLI) can reference `AGENTS.md` directly.

## Principles

- **Observation-based**: All inferences must be grounded in Git history and project config. Note when data is insufficient
- **Concise**: Key conventions only, no verbose explanations or generic advice
- **Include examples**: Good/Bad examples from actual commits and branches
- **Respect existing conventions**: Follow project-specific practices, don't impose generic best practices
