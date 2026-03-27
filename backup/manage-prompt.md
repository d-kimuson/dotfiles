---
description: 'When you want to create, edit, or manage Claude Code prompts (commands, agents, documents)'
disable-model-invocation: true
user-invocable: true
---

**Important**: Enable the `prompt-engineering` skill to access core prompt engineering guidelines.

<task_overview>
Create, update, or delete Claude Code prompts based on user instructions. Targets include:
- **Commands**: Invoked via `/command-name`
- **Agents**: Invoked via `@agent-name` or agent-task tool
- **Documents**: General-purpose prompt documents stored at any location
- **Context Files**: CLAUDE.md, AGENTS.md, GEMINI.md (always-loaded context)
</task_overview>

<decision_tree>
## Selecting the Prompt Type

Decision tree for determining the appropriate prompt type:

```
┌─ Does the user need context loaded for every session?
│  ├─ YES → Create **Context File** (.claude/CLAUDE.md, .gemini/GEMINI.md, .claude/.codex/AGENTS.md)
│  │  Use cases:
│  │  - Project-wide context needed by 80% of tasks
│  │  - Critical constraints and conventions
│  │  - Navigation/index to detailed documentation
│  │  Warning: Always-loaded cost is high, so minimize content
│  │
│  └─ NO (not needed by 80% of tasks) → Consider alternatives:
│     - Task-specific → Include in command/agent prompt
│     - Detailed guidelines → Create docs/ file and reference from context
│     - Rarely used → Let LLM discover through exploration
│
├─ Does the user need slash command invocation (e.g., /my-command)?
│  └─ YES → Create **Command** (.claude/commands/<name>.md)
│
├─ Does the user need a specialized subagent with specific model/configuration?
│  └─ YES → Create **Agent** (.claude/agents/<name>.md)
│     Use cases:
│     - Different model from main session (e.g., haiku for speed)
│     - Reusable specialized behavior (e.g., code review, PR creation)
│     - Programmatic invocation by Claude via agent-task tool
│
└─ Does the user need reusable instructions without special invocation?
   └─ YES → Create **Document** (custom path, e.g., docs/prompts/<name>.md)
      Use cases:
      - Reference material for other prompts
      - Checklists and guidelines
      - Shared instruction templates
```
</decision_tree>

<execution_workflow>
## Execution Workflow

### Step 1: Determine Prompt Type
Identify based on user request:
- **Context File** (`.claude/CLAUDE.md`, etc.): Context loaded every session
- **Command** (`.claude/commands/`): User wants `/command-name` invocation
- **Agent** (`.claude/agents/`): User wants `@agent-name` or agent-task tool usage
- **Document** (custom path): Location specified or general-purpose document

**For Context Files**: Apply additional scrutiny (see prompt-engineering skill for details)

### Step 2: Design Based on Principles
Apply guidelines from the prompt-engineering skill.

**For agents that require skills**:
- Use the `skills` frontmatter field to auto-load required skills
- ❌ Avoid: "**Important**: Please enable the `typescript` skill..." in body
- ✅ Prefer: `skills: [typescript, react]` in frontmatter
- Use manual `Skill(...)` only for conditional/dynamic skill loading

**Points to think harder about**:
- Single responsibility: What is the one thing this prompt does?
- Independence from caller: Can anyone invoke this without context?
- Essential information only: What is truly needed vs nice-to-have?
- Responsibility boundaries: What belongs here vs in CLAUDE.md?

**For orchestrators** (commands/agents that call subagents):
- **Invocation templates are required**: Include complete agent-task tool usage template showing how to call each subagent
- **Why templates matter**: Ensures consistency, makes patterns explicit, enables reproducible orchestration
- **Responsibility separation**: Subagents should be generic and reusable; task-specific context goes in orchestrator templates
- See `<orchestration_patterns>` in prompt-engineering skill for details

**For Context Files, think especially carefully** (see prompt-engineering skill):
- **80% rule**: Is all information needed by 80% of tasks?
- **Index-first**: Can it be replaced with pointers to detailed documentation?
- **Discoverability**: Can the LLM find it through exploration?
- **Scrutinize commands**: Will the LLM autonomously execute this command in typical tasks?
- **Extreme conciseness**: Can it be condensed further? Target under 100 lines.
- **Abstraction level**: Are you providing a map (good) or the territory (bad)?

### Step 3: Write Concisely
Follow prompt-engineering skill guidelines on conciseness and clarity.

### Step 4: Initial Validation
Run the automated checklist from the prompt-engineering skill.

### Step 5: Parallel Review Sessions
Launch 3 parallel `prompt-reviewer` agents to get diverse feedback.

**Important**: If the prompt is an orchestrator (calls subagents), have reviewers check:
- Presence of complete invocation templates (required)
- Template quality and completeness
- Proper responsibility separation between orchestrator and subagents

```
agent-task(
  agent="prompt-reviewer",
  message="Please review the following prompt:\n\n[prompt content]\n\nNote: This is an orchestrator prompt that calls subagents. Verify that invocation templates are complete and follow best practices."
)
agent-task(
  agent="prompt-reviewer",
  message="Please review the following prompt:\n\n[prompt content]\n\nNote: This is an orchestrator prompt that calls subagents. Verify that invocation templates are complete and follow best practices."
)
agent-task(
  agent="prompt-reviewer",
  message="Please review the following prompt:\n\n[prompt content]\n\nNote: This is an orchestrator prompt that calls subagents. Verify that invocation templates are complete and follow best practices."
)
```

### Step 6: Aggregate and Apply Feedback
- Collect feedback from all 3 review sessions
- Identify common issues across reviews
- Apply critical and moderate improvements
- Consider minor suggestions based on context
- Update the prompt file with improvements

### Step 7: Final Confirmation
Verify the file was created/updated correctly and report completion to the user.
</execution_workflow>
