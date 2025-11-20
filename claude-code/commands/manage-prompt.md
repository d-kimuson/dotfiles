---
description: 'Manage Claude Code prompts (commands, agents, and documents). Built with prompt/context engineering practices.'
---

**IMPORTANT**: Enable the `prompt-engineering` skill to access core prompt engineering guidelines.

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
┌─ User needs context loaded in EVERY session (CLAUDE.md, AGENTS.md, GEMINI.md)?
│  ├─ YES → Create **Context File** (.claude/CLAUDE.md, .codex/AGENTS.md, gemini-cli/GEMINI.md)
│  │  Use cases:
│  │  - Project-wide context needed in 80% of tasks
│  │  - Critical constraints and conventions
│  │  - Navigation/index to detailed documentation
│  │  WARNING: Minimize content - always loaded cost is high
│  │
│  └─ NO (not needed in 80% of tasks) → Consider alternatives:
│     - Task-specific → Include in command/agent prompts
│     - Detailed guidelines → Create docs/ files, reference from context
│     - Rarely used → Let LLM discover through exploration
│
├─ User needs slash command invocation (e.g., /my-command)?
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
Task(subagent_type="pr-creator", prompt="Create PR for current branch", description="Create PR")
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

<context_file_type>
### 4. Context Files (CLAUDE.md, AGENTS.md, GEMINI.md, etc.)

**Purpose**: Project-wide or global context automatically loaded in every session

<structure>
#### File Structure
- **Location**:
  - Project: `.claude/CLAUDE.md`, `.gemini/GEMINI.md`, `.claude/.codex/AGENTS.md`
  - Global: `~/.claude/CLAUDE.md`, `~/.gemini/GEMINI.md`, `~/.claude/.codex/AGENTS.md`
- **Processing**: Entire content is injected into every session's base context
- **No front matter**: Write content directly
</structure>

<critical_guidelines>
#### Critical Guidelines for Context Files

**⚠️ WARNING: Context files are loaded in EVERY session**
- Maximum cost: Context tokens consumed in every interaction
- Minimum content: Only include what 80% of tasks need
- Extreme conciseness: Typically <100 lines (aim for <500 tokens)
- Token budget: ~300-500 tokens ideal, 1000 tokens absolute maximum

**Content Strategy**:
1. **Prefer indices over direct content**
   - ❌ "Variables: camelCase, Types: PascalCase, Files: kebab-case..."
   - ✅ "Coding conventions: see docs/coding-style.md"

2. **Include only 80%-rule information**
   - Ask: "Is this needed in 80% of tasks?"
   - Essential: Repository structure, key conventions, critical constraints
   - Not essential: Deployment procedures, testing strategies, specific library usage

3. **Provide abstract, navigational information**
   - ✅ "Database migrations: alembic files in db/migrations/"
   - ❌ "To create migration: alembic revision -m 'description'"

4. **Scrutinize command examples**
   - ✅ Include: `pnpm build`, `pnpm test` (LLM runs these)
   - ❌ Exclude: `pnpm dev`, `docker-compose up` (user runs these)

**See prompt-engineering skill for detailed context file guidelines**
</critical_guidelines>
</context_file_type>
</prompt_types>

<execution_workflow>
## Execution Workflow

### Step 1: Determine Prompt Type
Based on user request, identify:
- **Context File** (`.claude/CLAUDE.md`, etc.): Context loaded in every session
- **Command** (`.claude/commands/`): User wants `/command-name` invocation
- **Agent** (`.claude/agents/`): User wants `@agent-name` or Task tool usage
- **Document** (custom path): User specifies location or general documentation

**If Context File**: Apply extra scrutiny in Step 2 (see below)

### Step 2: Design with Principles
Apply prompt-engineering skill guidelines.

**Think harder** about:
- Single responsibility: What is the ONE thing this prompt does?
- Caller independence: Can this be invoked by anyone without context?
- Essential information only: What's truly needed vs. nice-to-have?
- Responsibility boundaries: What belongs here vs. CLAUDE.md?

**For Context Files, think EXTRA HARD** about:
- **80% rule**: Is EVERY piece of information needed in 80% of tasks?
- **Index-first**: Can this be replaced with a pointer to detailed docs?
- **Discoverability**: Can LLM find this through exploration instead?
- **Command scrutiny**: Does LLM autonomously run this command in typical tasks?
- **Extreme conciseness**: Can this be condensed further? Target <100 lines.
- **Abstraction level**: Am I giving the map (good) or the territory (bad)?

### Step 3: Write Concisely
Follow prompt-engineering skill guidelines for conciseness and clarity.

### Step 4: Initial Validation
Run automated checklist from prompt-engineering skill.

### Step 5: Parallel Review Sessions
Launch 3 parallel `prompt-reviewer` agents to get diverse feedback:

```
Task(
  subagent_type="prompt-reviewer",
  prompt="Review the following prompt:\n\n[prompt content]",
  description="Review prompt (1/3)"
)
Task(
  subagent_type="prompt-reviewer",
  prompt="Review the following prompt:\n\n[prompt content]",
  description="Review prompt (2/3)"
)
Task(
  subagent_type="prompt-reviewer",
  prompt="Review the following prompt:\n\n[prompt content]",
  description="Review prompt (3/3)"
)
```

### Step 6: Aggregate and Apply Feedback
- Collect feedback from all 3 review sessions
- Identify common issues across reviews
- Apply critical and moderate improvements
- Consider minor suggestions based on context
- Update the prompt file with improvements

### Step 7: Final Confirmation
Confirm file is created/updated correctly and report completion to user.
</execution_workflow>
