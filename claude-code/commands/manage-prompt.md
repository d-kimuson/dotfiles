---
description: 'Manage Claude Code prompts (commands, agents, and documents). Built with prompt/context engineering practices.'
---

<task_overview>
Create, update, or delete Claude Code prompts based on user instructions. This includes:
- **Commands**: Invoked via `/command-name`
- **Agents**: Invoked via `@agent-name` or Task tool
- **Documents**: General prompt documents stored anywhere
</task_overview>

<decision_tree>
## Choosing the Right Prompt Type

<selection_guide>
Use this decision tree to determine which prompt type to create:

```
┌─ User needs slash command invocation (e.g., /my-command)?
│  └─ YES → Create **Command** (.claude/commands/<name>.md)
│
├─ User needs specialized sub-agent with specific model/settings?
│  └─ YES → Create **Agent** (.claude/agents/<name>.md)
│     Use cases:
│     - Different model than main session (e.g., haiku for speed)
│     - Reusable specialized behavior (e.g., code review, PR creation)
│     - Invoked programmatically by Claude via Task tool
│
└─ User needs reusable instructions without special invocation?
   └─ YES → Create **Document** (custom path, e.g., docs/prompts/<name>.md)
      Use cases:
      - Reference material for other prompts
      - Checklists and guidelines
      - Shared instruction templates
```
</selection_guide>
</decision_tree>

<prompt_types>
## Claude Code Prompt Types

<command_type>
### 1. Claude Code Commands

**Purpose**: Reusable instruction presets invoked by users with `/command-name [args]`

<structure>
#### File Structure
- **Location**: `.claude/commands/<command-name>.md`
- **Invocation**: `/command-name [additional instructions]`
- **Processing**: Front matter is excluded; body content is passed as instructions
</structure>

<front_matter>
#### Front Matter Specification
```yaml
---
description: 'Brief command description (required, <80 chars recommended)'
allowed-tools: Bash(git), Read(*), Write, Edit(*.ts)
---
```

**Field Details**:
- `description`: User-facing explanation (use repository's primary language)
- `allowed-tools`: Tools this command uses (optional but recommended)
  - Formats:
    - Allow all patterns: `ToolName(*)` e.g., `Read(*)`
    - Specific commands for single tool: `Bash(git)`, `Bash(gh)`
    - Multiple commands for single tool: `Bash(git, gh)` (comma-separated within parentheses)
    - Specific patterns: `Edit(*.ts)`, `Glob(*.json)`
    - Entire tool: `Write`, `Grep`
  - Multiple tools: comma+space separated between different tools
  - Example: `Bash(git, gh), Read(*), Edit(*.ts), Grep`
  - **Note**: Default-allowed tools need not be listed:
    - `TodoWrite`: Task list management
    - `Task`: Sub-agent invocation
    - `Glob`: File pattern matching
    - `Grep`: Content search
    - `Read`: File reading
</front_matter>
</command_type>

<agent_type>
### 2. Claude Code Agents

**Purpose**: Specialized sub-agents that can be invoked by Claude via Task tool or by users via `@agent-name`

<structure>
#### File Structure
- **Location**: `.claude/agents/<agent-name>.md`
- **Invocation by user**: `@agent-name [instructions]`
- **Invocation by Claude**: Task tool with `subagent_type: "agent-name"` parameter (matches filename without .md extension)
- **Processing**: Front matter is excluded; body content is passed as instructions

**Example Task tool invocation**:
```
Task(subagent_type="ccd-pr-creator", prompt="Create PR for current branch", description="Create PR")
```
</structure>

<front_matter>
#### Front Matter Specification
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
</front_matter>
</agent_type>

<document_type>
### 3. General Prompt Documents

**Purpose**: Standalone prompt documents not tied to Claude Code's command/agent system

<structure>
#### File Structure
- **Location**: User-specified path (e.g., `docs/prompts/<name>.md`, `.claude/docs/<name>.md`)
- **Invocation**: Manual reference or inclusion in other prompts
- **Processing**: No front matter required; entire content is the prompt
</structure>

<usage_note>
**Note**: Documents do not require front matter. Write content directly without metadata headers.
</usage_note>
</document_type>
</prompt_types>

<writing_guidelines>
## Prompt Writing Guidelines

Apply prompt engineering and context engineering best practices to design prompts that enable accurate and efficient task execution.

<core_principles>
### Core Principles

<single_responsibility>
#### Single Responsibility Principle
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
#### Caller Independence
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
#### Conciseness and Clarity
**Think harder about what's essential**:
- Include only necessary information for execution
- Remove redundant explanations
- Focus on rules and knowledge, not procedures
- Aim for 100-150 lines for complex agents, fewer for simple ones

**Red flags**:
- Detailed step-by-step procedures (trust the LLM)
- Repetitive examples for multiple languages (choose primary language)
- User-facing instructions (description field handles this)
- Implementation details that should be in CLAUDE.md
</conciseness>
</core_principles>

<principle name="structure_and_clarity">
### Structure and Clarity

<xml_tags>
#### XML Tag Utilization
Structure prompts with XML tags when multiple sections or concepts exist:
- **Recommended tags**: `<role>`, `<scope>`, `<principles>`, `<error_handling>`, `<workflow>`
- **Attribute usage**: `<step_1 name="descriptive_name">`, `<example type="good">`
- **Effect**: Clear instruction boundaries improve LLM comprehension accuracy
</xml_tags>

<specificity>
#### Instruction Specificity
- Eliminate ambiguity with concrete, non-contradictory instructions
- Include only verified, tested commands
- Explicitly define conditional logic and error handling
</specificity>

<cohesion>
#### Cohesion Optimization
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
</principle>

<principle name="information_design">
### Information Design

<information_responsibility>
#### Responsibility Boundaries
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
#### Extended Thinking Activation
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
#### Avoid Noise
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
</principle>

<principle name="language_and_format">
### Language and Format

<language_rule>
#### Language Usage Rules
- **Prompt body**: Write in English (for context efficiency)
- **`description` field (commands/agents)**: Match repository's primary language
  - Japanese project → Japanese
  - English project → English
</language_rule>

<format_rules>
#### Format Rules
- **No h1 headings**: Never start with h1 (`#`) title
- Start prompt content immediately after front matter
- Specify appropriate language for code blocks
</format_rules>
</principle>
</writing_guidelines>

<validation_process>
## Prompt Validation Process

After creating or updating prompts, execute the following validation process:

<automated_checklist>
### Automated Checklist
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
</automated_checklist>

<simulation_review>
### Sub-session Simulation (Optional)
For complex prompts, use the Task tool to review in a separate session:

```
You are reviewing a Claude Code prompt. Evaluate:
1. Is there a single clear responsibility?
2. Is it caller-independent (no orchestrator references)?
3. Is it concise without noise?
4. Are instructions clear and unambiguous?
5. Is information appropriately placed (vs. CLAUDE.md)?

Instructions to evaluate:
[Include full prompt content here]
```
</simulation_review>
</validation_process>

<execution_workflow>
## Execution Workflow

### Step 1: Determine Prompt Type
Based on user request, identify:
- **Command** (`.claude/commands/`): User wants `/command-name` invocation
- **Agent** (`.claude/agents/`): User wants `@agent-name` or Task tool usage
- **Document** (custom path): User specifies location or general documentation

### Step 2: Design with Principles
**Think harder** about:
- Single responsibility: What is the ONE thing this prompt does?
- Caller independence: Can this be invoked by anyone without context?
- Essential information only: What's truly needed vs. nice-to-have?
- Responsibility boundaries: What belongs here vs. CLAUDE.md?

### Step 3: Write Concisely
- Focus on rules and knowledge
- Trust the LLM to infer procedures
- Remove redundancy and noise
- Aim for clarity over completeness

### Step 4: Validate
1. Run automated checklist
2. Optional: Sub-session simulation for complex prompts
3. Confirm file is created/updated correctly
</execution_workflow>

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
</anti_patterns>
