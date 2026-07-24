# Agent Harness

Set up coding agent context files, project convention documents, and the project-local coding-guideline skill.

## Generated Files

| File | Location | When Referenced |
|------|----------|----------------|
| `CLAUDE.md` | Project root | Entry point — `@AGENTS.md` reference only |
| `AGENTS.md` | Project root | Always loaded — concise overview + reference pointers |
| `ARCHITECTURE.md` | `docs/` | System overview and quality strategy |
| `CODING_PROCESS.md` | `docs/` | Implementation process and Definition of Done |
| `QA_GUIDELINE.md` | `docs/` | Behavioral QA, E2E, exploratory testing |
| `COMMIT_MSG.md` | `docs/` | When creating commits |
| `BRANCH_NAMING.md` | `docs/` | When creating branches |
| `coding-guideline` skill | `.agents/skills/coding-guideline/` | When writing/reviewing/refactoring code |

## Procedure

### 1. Determine Output Directory

Check for existing docs directory (`docs/`, etc.). Default to `docs/`.

### 2. Create CLAUDE.md + AGENTS.md

Create `CLAUDE.md` from `CLAUDE.md` template — this is just `@AGENTS.md`.

Create `AGENTS.md` from `AGENTS.md` template. Fill in:

- project name
- short About Project description
- reference pointers to generated docs and coding-guideline skill

AGENTS.md must stay concise because it is always loaded. Put detailed architecture and procedures in referenced docs or skills.

Always include the `docs/human/**` rule: those files are human-facing and should not be read during normal agent work unless the task explicitly asks for human-facing docs.

### 3. Architecture Document

Create `docs/ARCHITECTURE.md` from `ARCHITECTURE.md` template and customize:

- high-level system diagram
- frontend/backend/API/database/external-service responsibilities
- core data/request flow
- project-specific quality strategy

Keep this document as the stable system overview. Implementation details belong in the coding-guideline skill.

### 4. Project Coding Guideline Skill

Copy `.agents/skills/coding-guideline/` into the project.

Customize the references based on selected setup references:

- Backend/server code: keep and customize `references/backend/guideline.md` when `hono/` or another backend reference is selected.
- Frontend/web code: keep and customize `references/frontend/guideline.md` when `tanstack-start/` is selected.
- If the project is frontend-only or backend-only, remove the irrelevant reference and update `SKILL.md`'s Required References list.

The skill body should stay agent-facing and concise. Put broad design rationale in docs only when it helps future agents make decisions.

### 5. Coding Process + Definition of Done

Create `docs/CODING_PROCESS.md` from `CODING_PROCESS.md` template. Investigate:

- available check commands (`pnpm gatecheck check`, `pnpm typecheck`, `pnpm lint`, etc.)
- build and deployment commands
- project-specific workflows (fixture updates, code generation, migrations, etc.)

Definition of Done should be based on `pnpm gatecheck check` and add any checks not covered by gatecheck.

### 6. QA Guideline

Create `docs/QA_GUIDELINE.md` from `QA_GUIDELINE.md` template. Customize:

- dev server command and URL
- E2E command and Playwright configuration
- whether auth bypass such as `DISABLE_AUTH=true` exists for QA/E2E
- project-specific state reset or seed data procedures

For apps with OAuth or other external auth, recommend an E2E-only auth bypass so agents can verify behavior without using real external login.

### 7. Commit Message Conventions

Use `COMMIT_MSG.md` template as a starting point.

Run `git log --oneline -50` and analyze:

- **Prefix**: Conventional Commits (`feat:`, `fix:`, `chore:`) or custom?
- **Scope**: `feat(api):` style scoping?
- **Format**: Language, tense, capitalization
- **Other**: Issue reference format (`#123`, `PROJ-123`)

Customize the template with Good/Bad examples from actual history when data exists. If history is insufficient, keep the template convention and note that it is the initial convention.

### 8. Branch Naming Conventions

Run `git branch -a` and analyze:

- **Prefix**: `feature/`, `fix/`, `hotfix/`
- **Separator**: `/`, `-`, `_`
- **Pattern**: `feature/issue-123-description`, `fix/short-desc`

Generate `BRANCH_NAMING.md` with examples.

## Cross-Agent CLI Compatibility

`CLAUDE.md` uses `@AGENTS.md` to delegate content, making `AGENTS.md` the single source of truth. Other agent CLIs can reference `AGENTS.md` directly.

## Principles

- **Progressive disclosure**: AGENTS.md is short; details live in docs and skills.
- **Observation-based**: Inferences should be grounded in code, config, and Git history. Note when data is insufficient.
- **Concise**: Key conventions only, no verbose generic advice.
- **Include examples**: Good/Bad examples from actual commits and branches when available.
- **Respect existing conventions**: Follow project-specific practices; don't impose generic best practices blindly.
