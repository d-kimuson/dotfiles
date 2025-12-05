---
name: prompt-engineering
description: Core prompt engineering and context engineering best practices for Claude Code prompts.
---

<claude_code_prompts>
## Claude Code Prompt Types

<command_type>
### 1. Commands
**Purpose**: Reusable instruction presets invoked by users with `/command-name [args]`

**Structure**:
- **Location**: `.claude/commands/<command-name>.md`
- **Invocation**: `/command-name [additional instructions]`
- **Processing**: Front matter excluded; body content passed as instructions

**Front Matter**:
```yaml
---
description: 'Brief description (required, <80 chars, repository's primary language)'
allowed-tools: Bash(git, gh), Read(*), Edit(*.ts), Grep  # optional but recommended
---
```

**allowed-tools formats**: `ToolName(*)`, `Bash(git)`, `Bash(git, gh)`, `Edit(*.ts)`, `Write`
- Multiple tools: comma+space separated
- Default-allowed tools (can omit): `TodoWrite`, `Task`, `Glob`, `Grep`, `Read`

**Audience**: `description` → user (project language); body → LLM worker (English)
</command_type>

<agent_type>
### 2. Agents
**Purpose**: Specialized sub-agents invoked via Task tool or `@agent-name`

**Structure**:
- **Location**: `.claude/agents/<agent-name>.md`
- **Invocation**: `@agent-name [instructions]` or `Task(subagent_type="agent-name", ...)`
- **Processing**: Front matter excluded; body content passed as instructions

**Front Matter**:
```yaml
---
name: agent-name  # must match filename without .md
description: 'Brief agent description'
model: sonnet  # or haiku, or inherit (use caller's model)
color: cyan    # terminal display color
skills:        # optional: auto-load skills when agent starts
  - typescript
  - react
---
```

**skills field**:
- Skills listed here are automatically loaded when the agent is invoked
- No need for manual `Skill(...)` calls or "Enable the X skill" instructions in body
- Use this for skills the agent ALWAYS needs (not conditionally)
- For dynamic/conditional skill loading, use `Skill(...)` tool in the prompt body

**Audience**: Both caller (orchestrator LLM) and executor (sub-agent LLM) are LLMs
- Always English
- No orchestrator concerns (when to invoke, what to do with output)
- Focus on capability grant and input/output contract
</agent_type>

<skill_type>
### 3. Skills
**Purpose**: Reusable knowledge/guidelines loaded into sessions

**Structure**:
- **Location**: `.claude/skills/<skill-name>/SKILL.md`
- **Invocation**: Skill tool or auto-loaded based on description
- **Processing**: Front matter excluded; body injected into context

**Front Matter**:
```yaml
---
name: skill-name  # must match directory name
description: 'When this skill should be enabled'
---
```

**Audience**: Any LLM (main session, orchestrator, or sub-agent)
- Grant knowledge/capability, not orchestrate workflows
- Principles, best practices, rules (not "first do X, then Y")
- Reproducible, interpretation-stable content
</skill_type>

<document_type>
### 4. Documents
**Purpose**: Standalone prompts not tied to command/agent system

**Structure**:
- **Location**: User-specified (e.g., `docs/prompts/<name>.md`)
- **Invocation**: Manual reference or inclusion
- **Processing**: No front matter; entire content is the prompt
</document_type>

<context_files>
### 5. Context Files (CLAUDE.md, GEMINI.md, AGENTS.md, etc.)
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

**Content Principles**:

1. **Index-first**: Pointers to detailed docs, not exhaustive content
   - ❌ "Use camelCase for variables, PascalCase for types..."
   - ✅ "Coding conventions: docs/coding-style.md"
   - Use direct content only if: cannot be discovered, critically affects every task, extremely concise (1-2 lines)

2. **80% rule**: Only information needed in 80% of tasks
   - ✅ Repository structure, key conventions, critical constraints
   - ❌ Deployment procedures, testing strategies, specific library usage

3. **Abstract/navigational**: Materials to find information, not exhaustive details
   - ✅ "Database: alembic files in db/migrations/"
   - ❌ "To create migration: alembic revision -m 'description'"

4. **Command scrutiny**: Only commands LLM runs autonomously in typical tasks
   - ✅ `pnpm build`, `pnpm test` (LLM runs these)
   - ❌ `pnpm dev`, `docker-compose up` (user runs these)

**Good example**:
```markdown
# Project Context
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

**Bad example** (avoid):
```markdown
# Project Setup
## Installation
1. Install dependencies: `pnpm install`
2. Set up database: `pnpm db:setup`
...
[Detailed step-by-step procedures, exhaustive architecture details...]
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

<orchestration_patterns>
### Orchestration Patterns
**When designing prompts for orchestrated workflows with subagents**:

<prompt_templates>
#### Use Prompt Templates for Subagent Invocation
**CRITICAL REQUIREMENT: Orchestrators MUST provide explicit invocation templates**:
- Include complete prompt templates showing how to invoke subagents with all parameters
- Templates are NOT optional—they are essential for stable, reproducible orchestration
- Keep summaries minimal; let templates convey specifics through concrete examples
- Templates ensure consistency across multiple invocations and make maintenance easier

**Why templates are essential**:
1. **Consistency**: Same invocation pattern every time, reducing variability
2. **Reproducibility**: Future maintainers can see exact invocation structure
3. **Clarity**: Makes the orchestration contract explicit, not implicit
4. **Maintainability**: Single source of truth for how subagents should be invoked
5. **Discoverability**: New users can understand the pattern immediately

**Without templates** (❌ Bad):
```markdown
Invoke the engineer agent to implement the feature.
```
**Problem**: Orchestrator must guess parameter structure, leading to inconsistent invocations

**With templates** (✅ Good):
```markdown
## Invoking the Implementation Agent

Use this template:

Task(
  subagent_type="engineer",
  prompt="""
Implement the following feature:
{feature_description}

Requirements:
{requirements}

Acceptance criteria:
{acceptance_criteria}

Follow project conventions and include tests.
""",
  description="Implement {feature_name}"
)
```
</prompt_templates>

<responsibility_split>
#### Split Responsibilities Between Orchestrator and Subagent

**Design principle**: Subagents are single-purpose but reusable across many tasks. Task-specific context belongs in the orchestrator's template; responsibility-specific practices belong in the subagent.

**Subagent prompt** (responsibility-specific, reusable):
- Core practices always needed for this responsibility
- Domain-specific knowledge and constraints
- General workflow for this type of task
- Error handling patterns for this domain
- Quality standards for this responsibility

**Orchestrator's invocation template** (task-specific, contextual):
- Current task context and background
- Task-specific rules and constraints
- Specific focus areas or priorities for this task
- Integration requirements with other workflow steps
- Project-specific constraints not universally applicable

**Example - Code Review Agent**:

Subagent prompt (`.claude/agents/reviewer.md`):
```markdown
Review code changes for quality and correctness.

Check for:
- Type safety and correctness
- Security vulnerabilities
- Performance issues
- Code style consistency
- Test coverage adequacy

Report issues with:
- Severity level (critical/moderate/minor)
- File path and line numbers
- Specific recommendations
- Priority order (critical first)
```

Orchestrator's template:
```markdown
Task(
  subagent_type="reviewer",
  prompt="""
Review the authentication feature implementation.

Context: Healthcare application handling PHI data under HIPAA.

Additional requirements for this review:
- HIPAA compliance is critical (report violations as critical)
- All database queries must use parameterized statements
- Session tokens must expire within 15 minutes
- Password hashing must use bcrypt with cost factor ≥12

Files to review: src/auth/*.ts

Focus on security and compliance issues.
""",
  description="Review auth implementation"
)
```
</responsibility_split>

<design_questions>
#### Design Questions for Responsibility Split

When designing orchestrated prompts, ask these questions:

**Should this go in the subagent prompt?**
- Is this practice always required for this type of task?
- Does this define the agent's core responsibility?
- Would this agent need this knowledge for ANY task it handles?
- Is this domain-specific expertise for this responsibility?
→ **YES**: Include in subagent prompt

**Should this go in the orchestrator's template?**
- Is this specific to the current task or project?
- Does this depend on previous steps in the workflow?
- Is this a temporary constraint or priority?
- Does this require context from the orchestration flow?
→ **YES**: Include in invocation template

**Examples**:
- ✅ Subagent: "Check for type errors and unused variables"
- ✅ Orchestrator: "Focus on the payment module we refactored in the previous step"
- ✅ Subagent: "Report security vulnerabilities with severity levels"
- ✅ Orchestrator: "This handles credit card data—PCI-DSS compliance is critical"
- ✅ Subagent: "Include test coverage for new functionality"
- ✅ Orchestrator: "We're under tight deadline—prioritize happy path tests"
</design_questions>

<benefits>
#### Benefits of This Approach

**Reusability**: Subagents work across different tasks and projects without modification

**Maintainability**: Task-specific logic lives in one place (orchestrator), not scattered across agent prompts

**Clarity**: Clear separation makes it obvious what's universal vs. contextual

**Consistency**: Templates ensure subagents receive consistent, well-formed instructions

**Testability**: Subagents can be tested independently with different invocation parameters
</benefits>

<orchestration_anti_patterns>
#### Common Anti-Patterns in Orchestration

**❌ Duplicating logic across orchestrator and subagent**:
```markdown
# Subagent prompt
- Follow project coding conventions
- Use TypeScript strict mode
- Never commit secrets

# Orchestrator template
Task(prompt="""
Follow project coding conventions.
Use TypeScript strict mode.
Never commit secrets.
Implement feature X...
""")
```
**Problem**: Maintenance burden, inconsistency risk

**✅ Keep domain practices in subagent only**:
```markdown
# Subagent prompt
- Follow project coding conventions
- Use TypeScript strict mode
- Never commit secrets

# Orchestrator template
Task(prompt="""
Implement feature X with focus on payment processing logic.
Ensure PCI-DSS compliance for card data handling.
""")
```

---

**❌ Making subagents too task-specific**:
```markdown
name: implement-user-authentication-with-jwt-and-oauth
```
**Problem**: Not reusable, violates single responsibility

**✅ Keep subagents generic within their domain**:
```markdown
name: engineer
# Orchestrator specifies: "Implement user authentication using JWT and OAuth"
```

---

**❌ Passing orchestration context to subagents**:
```markdown
Task(prompt="""
This is step 3 of 5 in the workflow.
After you finish, I will invoke the testing agent.
The architect agent already designed this in step 1.
""")
```
**Problem**: Violates caller independence, adds unnecessary context

**✅ Provide only task-relevant information**:
```markdown
Task(prompt="""
Implement the authentication feature.
Architecture decisions: See attached design document.
Focus on token generation and validation logic.
""")
```
</orchestration_anti_patterns>

<orchestration_considerations>
#### Additional Considerations

**Failure Handling**:
- Orchestrators should handle subagent failures gracefully
- Define retry strategies for critical tasks
- Provide clear error reporting from subagents back to orchestrators
- Consider fallback strategies for non-critical failures

**Template Maintenance**:
- Keep invocation templates in one location for easy updates
- When subagent prompts change, review all orchestrator templates
- Document expected inputs/outputs for each subagent
</orchestration_considerations>
</orchestration_patterns>
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
- [ ] Appropriate model selected (`sonnet` for complex tasks, `haiku` for speed, `inherit` for caller's model)
- [ ] `skills` field used for always-required skills (no manual "Enable X skill" in body)
- [ ] No "invocation_context" or similar caller-specific sections

**For orchestrator prompts** (commands/agents that invoke subagents):
- [ ] Includes explicit invocation templates for all subagents used
- [ ] Templates show complete Task tool usage with all parameters
- [ ] Task-specific context is in templates, not duplicated in subagent prompts
- [ ] No orchestration workflow details passed to subagents (violates caller independence)
- [ ] Subagents are kept generic and reusable within their domain

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
