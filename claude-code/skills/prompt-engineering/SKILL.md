---
name: prompt-engineering
description: Core prompt engineering and context engineering best practices for Claude Code prompts.
---

<claude_code_prompts>
## Claude Code Prompt Types

Claude Code supports three types of prompts:

<command_type>
### 1. Commands
**Purpose**: Reusable instruction presets invoked by users with `/command-name [args]`

**File Structure**:
- **Location**: `.claude/commands/<command-name>.md`
- **Invocation**: `/command-name [additional instructions]`
- **Processing**: Front matter is excluded; body content is passed as instructions

**Front Matter Specification**:
```yaml
---
description: 'Brief command description (required, <80 chars recommended)'
allowed-tools: Bash(git), Read(*), Write, Edit(*.ts)
---
```

**Field Details**:
- `description`: User-facing explanation (use repository's primary language)
- `allowed-tools`: Tools this command uses (optional but recommended)
  - Formats: `ToolName(*)`, `Bash(git)`, `Bash(git, gh)`, `Edit(*.ts)`, `Write`, `Grep`
  - Multiple tools: comma+space separated
  - Example: `Bash(git, gh), Read(*), Edit(*.ts), Grep`
  - Default-allowed tools need not be listed: `TodoWrite`, `Task`, `Glob`, `Grep`, `Read`
</command_type>

<agent_type>
### 2. Agents
**Purpose**: Specialized sub-agents that can be invoked by Claude via Task tool or by users via `@agent-name`

**File Structure**:
- **Location**: `.claude/agents/<agent-name>.md`
- **Invocation by user**: `@agent-name [instructions]`
- **Invocation by Claude**: Task tool with `subagent_type: "agent-name"` parameter
- **Processing**: Front matter is excluded; body content is passed as instructions

**Front Matter Specification**:
```yaml
---
name: agent-name
description: 'Brief agent description'
model: sonnet  # or haiku
color: cyan    # Terminal display color
---
```

**Field Details**:
- `name`: Agent identifier (must match filename without extension)
- `description`: Brief explanation of agent's purpose
- `model`: LLM model to use (`sonnet` or `haiku`)
- `color`: Terminal UI color for agent output
</agent_type>

<skill_type>
### 3. Skills
**Purpose**: Reusable knowledge and guidelines that can be loaded into sessions

**File Structure**:
- **Location**: `.claude/skills/<skill-name>/SKILL.md`
- **Invocation**: Skill tool with skill name, or auto-loaded based on description
- **Processing**: Front matter is excluded; body content is injected into context

**Front Matter Specification**:
```yaml
---
name: skill-name
description: 'When this skill should be enabled'
---
```

**Field Details**:
- `name`: Skill identifier (must match directory name)
- `description`: Conditions for when skill should be enabled (e.g., "Must always be enabled when writing TypeScript code")
</skill_type>

<document_type>
### 4. Documents
**Purpose**: Standalone prompt documents not tied to Claude Code's command/agent system

**File Structure**:
- **Location**: User-specified path (e.g., `docs/prompts/<name>.md`, `.claude/docs/<name>.md`)
- **Invocation**: Manual reference or inclusion in other prompts
- **Processing**: No front matter required; entire content is the prompt
</document_type>

<context_files>
### 5. Context Files (CLAUDE.md, GEMINI.md, etc.)
**Purpose**: Project-wide or global context that is automatically loaded in every session

**File Structure**:
- **Location**:
  - Project: `.claude/CLAUDE.md`, `.gemini/GEMINI.md`, `.claude/.codex/AGENTS.md`
  - Global: `~/.claude/CLAUDE.md`, `~/.gemini/GEMINI.md`, `~/.claude/.codex/AGENTS.md`
- **Processing**: Entire content is injected into every session's base context
- **No front matter**: Write content directly

**Critical Characteristics**:
- **Always loaded**: Read in every single session, regardless of task
- **Maximum cost**: Context tokens consumed in every interaction
- **Minimum content**: Only include what 80% of tasks need

**IMPORTANT**: These are guidelines, not absolute rules. Some projects have unique contexts that justify exceptions. Use judgment, but default to minimalism when uncertain.

**Content Guidelines**:

<minimize_direct_content>
**1. Prefer Indices Over Direct Content**
Instead of writing full guidelines, provide pointers to detailed documentation:
- ❌ Direct: "Use camelCase for variables, PascalCase for types, kebab-case for files..."
- ✅ Index: "Coding conventions: see docs/coding-style.md"
- ❌ Direct: "Authentication flow: 1) User submits credentials, 2) Server validates..."
- ✅ Index: "Architecture decisions: see docs/architecture/"

**When to use direct content**: Only for information that:
- Cannot be discovered through exploration
- Critically affects every task (e.g., "Never modify files in vendor/")
- Is extremely concise (1-2 lines)
</minimize_direct_content>

<essential_only>
**2. Include Only 80%-Rule Information**
Ask for each piece of information: "Is this needed in 80% of tasks?"
- ✅ Essential: Repository structure, key conventions, critical constraints
- ❌ Not essential: Deployment procedures, testing strategies, specific library usage
- ✅ Essential: "Use pnpm (project uses pnpm workspaces)"
- ❌ Not essential: "Run dev server with `pnpm dev`" (LLM doesn't typically run dev servers)
</essential_only>

<abstract_material>
**3. Provide Abstract, Navigational Information**
Give LLM the materials to find what it needs:
- ✅ "Database schema migrations: alembic files in db/migrations/"
- ✅ "API documentation: docs/api/ (organized by version)"
- ✅ "Component library: src/components/ (see README for guidelines)"
- ❌ "To create a migration, run: alembic revision -m 'description'"
- ❌ "API versioning follows semver: v1.0.0 format with..."
</abstract_material>

<command_examples_scrutiny>
**4. Scrutinize Command Examples**
Only include commands that LLM uses in standard workflows:
- ✅ Include: `git commit`, `pnpm build`, `pnpm test` (standard development)
- ❌ Exclude: `pnpm dev`, `docker-compose up` (user runs these, not LLM)
- ❌ Exclude: Deployment commands (unless LLM handles deployments)
- ❌ Exclude: Database seed commands (unless frequently needed)

**Test**: "Does LLM run this command autonomously in typical tasks?"
- If user needs to see output (dev server, logs) → Exclude
- If command is for user convenience (aliases, shortcuts) → Exclude
- If command is part of implementation/testing workflow → Include
</command_examples_scrutiny>

**Example - Good Context File**:
```markdown
# Project Context

## Architecture
- Monorepo using pnpm workspaces
- API: packages/api (NestJS)
- Frontend: packages/web (Next.js)
- Detailed architecture: docs/architecture/README.md

## Key Conventions
- Branch naming: feature/*, bugfix/* (see docs/git-workflow.md)
- Never modify: src/generated/* (auto-generated code)
- Testing: Vitest for unit, Playwright for E2E (see docs/testing.md)

## Critical Constraints
- All database changes require migration (alembic)
- Public API changes require version bump (semver)
```

**Example - Poor Context File** (avoid):
```markdown
# Project Setup

## Installation
1. Install dependencies: `pnpm install`
2. Set up database: `pnpm db:setup`
3. Run migrations: `pnpm db:migrate`
4. Seed data: `pnpm db:seed`
5. Start dev server: `pnpm dev`
6. Open browser: http://localhost:3000

## Development Workflow
- Create feature branch from main
- Make your changes
- Run linter: `pnpm lint`
- Run tests: `pnpm test`
- Commit with conventional commits
- Push and create PR
- Wait for CI to pass
- Request review

## Architecture
[500 lines of detailed architecture documentation that should be in docs/]
```
</context_files>
</claude_code_prompts>

<core_principles>
## Core Principles

<single_responsibility>
### Single Responsibility Principle
**Like functions in programming - one clear purpose**:
- Each prompt (especially agents) should have one well-defined responsibility
- Avoid mixing multiple concerns (e.g., don't mix "setup environment" with "implement code")
- Clear boundaries make prompts composable and maintainable

**Example**:
- ✅ Agent A: Environment setup only
- ✅ Agent B: Code implementation only
- ❌ Agent C: Setup, implement, review, and deploy (too many responsibilities)
</single_responsibility>

<caller_independence>
### Caller Independence
**Prompts should not know about their caller's context**:
- Don't reference "orchestrator", "parent task", or calling patterns
- Focus on: "What do I receive?" and "What do I produce?"
- Users and other agents should be able to invoke the same prompt
- Maximize reusability by keeping prompts context-free

**Avoid**:
- ❌ "You are invoked by the orchestrator with a task document path..."
- ❌ "After completion, report back to the orchestrator..."
- ❌ "Read the task document to understand what the parent wants..."

**Prefer**:
- ✅ "Analyze the provided code and identify issues..."
- ✅ "Based on the instructions, design an implementation approach..."
</caller_independence>

<conciseness>
### Conciseness and Clarity
**Think harder about what's essential**:
- Include only necessary information for execution
- Remove redundant explanations
- Focus on rules and knowledge, not procedures

**Red flags**:
- Detailed step-by-step procedures (trust the LLM)
- Repetitive examples for multiple languages (choose primary language)
- User-facing instructions (description field handles this)
- Implementation details that should be in CLAUDE.md
</conciseness>
</core_principles>

<structure_and_clarity>
## Structure and Clarity

<xml_tags>
### XML Tag Utilization
Structure prompts with XML tags when multiple sections or concepts exist:
- **Recommended tags**: `<role>`, `<scope>`, `<principles>`, `<error_handling>`, `<workflow>`
- **Attribute usage**: `<step_1 name="descriptive_name">`, `<example type="good">`
- **Effect**: Clear instruction boundaries improve LLM comprehension accuracy
</xml_tags>

<specificity>
### Instruction Specificity
- Eliminate ambiguity with concrete, non-contradictory instructions
- Include only verified, tested commands
- Explicitly define conditional logic and error handling
</specificity>

<cohesion>
### Cohesion Optimization
Group related instructions, rules, and constraints within the same section.

**High cohesion example**:
```xml
<workflow>
## Basic Flow

**1. Check prerequisites**:
- Verify git repository exists
- Confirm gh CLI is authenticated
- Error if not: Run `gh auth login`

**2. Proceed with task**:
...
</workflow>
```

**Low cohesion example** (avoid):
```xml
<prerequisites>Verify git repository</prerequisites>
<step_1>Check authentication</step_1>
<errors>If gh fails, run gh auth login</errors>
```
</cohesion>
</structure_and_clarity>

<information_design>
## Information Design

<information_responsibility>
### Responsibility Boundaries
**What belongs in prompts vs. CLAUDE.md**:

**CLAUDE.md** (project-level, always available):
- Overall architecture and tech stack
- File naming conventions (not just examples - actual rules)
- Project-wide coding standards
- Development workflows
- Tool configurations

**Prompts** (task-specific):
- Task-specific rules and knowledge
- Workflow for the specific responsibility
- Error handling for this specific task
- Task-specific constraints

**Example**:
- ❌ In agent: "Check CONTRIBUTING.md or docs/contributing.md for conventions"
  - Problem: Guessing file locations is noisy
  - Solution: CLAUDE.md should document where conventions are
- ✅ In agent: "Follow project conventions for branch naming"
  - The agent trusts conventions are available in base context
</information_responsibility>

<extended_thinking>
### Extended Thinking Activation
**Automatic activation via keywords**:
- Use "think harder" for complex reasoning tasks
- Use "ultrathink" for very deep analysis
- Claude Code automatically enables extended thinking mode
- No need to instruct `<think>` tag usage

**Example**:
```markdown
Review the code changes carefully. Think harder about potential edge cases and security implications.
```
</extended_thinking>

<avoid_noise>
### Avoid Noise
**Common sources of noise**:
- Multiple language examples (pick primary: Node.js > others for most projects)
- Hypothetical file paths without project confirmation (CONTRIBUTING.md, ARCHITECTURE.md)
- Generic architectural patterns (should be in CLAUDE.md if relevant)
- Detailed procedures the LLM can infer

**Example of noisy content** (avoid):
```markdown
Install dependencies:
- Node.js: npm install OR yarn install OR pnpm install
- Python: pip install -r requirements.txt OR poetry install
- Ruby: bundle install
- Go: go mod download
```

**Better** (concise):
```markdown
Install dependencies using project's package manager (detected from lock files).
```
</avoid_noise>
</information_design>

<language_and_format>
## Language and Format

<language_rule>
### Language Usage Rules
- **Prompt body**: Write in English (for context efficiency)
- **`description` field (commands/agents)**: Match repository's primary language
  - Japanese project → Japanese
  - English project → English
</language_rule>

<format_rules>
### Format Rules
- **No h1 headings**: Never start with h1 (`#`) title
- Start prompt content immediately after front matter
- Specify appropriate language for code blocks
</format_rules>
</language_and_format>

<validation_checklist>
## Validation Checklist

Verify before creation/update:

**For all prompt types**:
- [ ] Does not start with h1 heading (`#`)
- [ ] XML tags are properly closed (matching pairs)
- [ ] Prompt body is written in English (for context efficiency)
- [ ] Error handling is defined for expected failure cases
- [ ] **Single responsibility**: Prompt has one clear purpose
- [ ] **Caller independent**: No references to "orchestrator", "parent", calling context
- [ ] **Concise**: Only essential information included (typically 100-150 lines for agents)
- [ ] **No noise**: Removed redundant examples, hypothetical paths, generic patterns

**For commands** (`.claude/commands/*.md`):
- [ ] Front matter includes `description` field
- [ ] `allowed-tools` is defined with correct syntax (optional but recommended)

**For agents** (`.claude/agents/*.md`):
- [ ] Front matter includes `name`, `description`, `model`, `color`
- [ ] `name` field matches filename (without .md extension)
- [ ] Appropriate model selected (`sonnet` for complex tasks, `haiku` for speed)
- [ ] No "invocation_context" or similar caller-specific sections

**For documents** (custom paths):
- [ ] No front matter included (entire content is prompt)
- [ ] Location/path is clearly specified in user instructions

**For context files** (CLAUDE.md, AGENTS.md, GEMINI.md, etc.):
- [ ] No front matter included (entire content is context)
- [ ] **80% rule**: Every piece of information is needed in 80% of tasks
- [ ] **Index-first**: Direct content minimized, pointers to detailed docs used instead
- [ ] **Abstract/navigational**: Provides materials to find information, not exhaustive details
- [ ] **Command scrutiny**: Only commands LLM autonomously runs in typical tasks
- [ ] No step-by-step procedures (e.g., "1. Install, 2. Setup, 3. Run...")
- [ ] No user-facing workflows (e.g., "Start dev server and open browser")
- [ ] Extremely concise (typically <100 lines for project context)
</validation_checklist>

<anti_patterns>
## Common Anti-Patterns to Avoid

**❌ Caller coupling**:
```markdown
You are invoked by the orchestrator with a task document at `.cc-delegate/tasks/<id>.md`.
Read the task document to understand...
```

**✅ Caller independence**:
```markdown
Design an implementation approach based on the provided requirements and context.
```

---

**❌ Multiple responsibilities**:
```markdown
Agent: setup-and-implement
- Create branch
- Install dependencies
- Implement feature
- Run tests
- Create PR
```

**✅ Single responsibility**:
```markdown
Agent: implement-feature
- Focus solely on implementation
- Assume environment is ready
- Produce working code with tests
```

---

**❌ Noise and redundancy**:
```markdown
Install dependencies:
- pnpm-lock.yaml exists → run pnpm install
- package-lock.json exists → run npm install
- yarn.lock exists → run yarn install
- Pipfile exists → run pipenv install
- requirements.txt exists → run pip install
```

**✅ Concise abstraction**:
```markdown
Install dependencies using detected package manager (from lock file).
```

---

**❌ Hypothetical file paths**:
```markdown
Check CONTRIBUTING.md, CONTRIBUTING.txt, docs/CONTRIBUTING.md,
docs/contributing.md, or DEVELOPMENT.md for conventions.
```

**✅ Trust base context**:
```markdown
Follow project conventions (documented in base context).
```

---

**❌ Context file with exhaustive details**:
```markdown
# CLAUDE.md

## Coding Style
- Variables: camelCase (e.g., userName, itemCount)
- Types: PascalCase (e.g., UserProfile, ItemList)
- Files: kebab-case (e.g., user-profile.ts, item-list.tsx)
- Constants: UPPER_SNAKE_CASE (e.g., API_URL, MAX_ITEMS)
- Functions: camelCase with verb prefix (e.g., getUserName, calculateTotal)
...
[50 more lines of coding style]
```

**✅ Context file with index**:
```markdown
# CLAUDE.md

## Coding Style
See docs/coding-style.md for naming conventions and formatting rules.

## Critical: Never modify src/generated/* (auto-generated)
```

---

**❌ Context file with user-facing workflows**:
```markdown
## Development Setup
1. Install dependencies: `pnpm install`
2. Start database: `docker-compose up db`
3. Run migrations: `pnpm db:migrate`
4. Start dev server: `pnpm dev`
5. Open http://localhost:3000 in your browser
```

**✅ Context file with LLM-relevant info**:
```markdown
## Development
- Package manager: pnpm (workspaces enabled)
- Database migrations: alembic (db/migrations/)
- Build: `pnpm build`, Test: `pnpm test`
```
</anti_patterns>
