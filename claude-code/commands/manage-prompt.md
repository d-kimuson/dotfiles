---
description: 'Manage Claude Code prompts (commands, agents, and documents). Built with prompt/context engineering practices.'
---

**IMPORTANT**: Enable the `prompt-engineering` skill to access core prompt engineering guidelines.

<task_overview>
Create, update, or delete Claude Code prompts based on user instructions. This includes:
- **Commands**: Invoked via `/command-name`
- **Agents**: Invoked via `@agent-name` or Task tool
- **Documents**: General prompt documents stored anywhere
- **Context Files**: CLAUDE.md, AGENTS.md, GEMINI.md (always-loaded context)
</task_overview>

<decision_tree>
## Choosing the Right Prompt Type

Use this decision tree to determine which prompt type to create:

```
┌─ User needs context loaded in EVERY session?
│  ├─ YES → Create **Context File** (.claude/CLAUDE.md, .gemini/GEMINI.md, .claude/.codex/AGENTS.md)
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
</decision_tree>

<execution_workflow>
## Execution Workflow

### Step 1: Determine Prompt Type
Based on user request, identify:
- **Context File** (`.claude/CLAUDE.md`, etc.): Context loaded in every session
- **Command** (`.claude/commands/`): User wants `/command-name` invocation
- **Agent** (`.claude/agents/`): User wants `@agent-name` or Task tool usage
- **Document** (custom path): User specifies location or general documentation

**If Context File**: Apply extra scrutiny (see prompt-engineering skill for detailed guidelines)

### Step 2: Design with Principles
Apply prompt-engineering skill guidelines.

**For Agents requiring Skills**:
- Use `skills` front matter field to auto-load required skills
- ❌ Avoid: "**IMPORTANT**: Enable the `typescript` skill..." in body
- ✅ Prefer: `skills: [typescript, react]` in front matter
- Only use manual `Skill(...)` for conditional/dynamic skill loading

**Think harder** about:
- Single responsibility: What is the ONE thing this prompt does?
- Caller independence: Can this be invoked by anyone without context?
- Essential information only: What's truly needed vs. nice-to-have?
- Responsibility boundaries: What belongs here vs. CLAUDE.md?

**For Orchestrators** (commands/agents that invoke subagents):
- **Invocation templates are ESSENTIAL**: Include complete Task tool usage templates showing how to invoke each subagent
- **Why templates matter**: They ensure consistency, make the pattern explicit, and enable reproducible orchestration
- **Responsibility split**: Keep subagents generic/reusable; task-specific context goes in orchestrator's template
- See `<orchestration_patterns>` in prompt-engineering skill for detailed guidance

**For Context Files, think EXTRA HARD** (see prompt-engineering skill):
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
Launch 3 parallel `prompt-reviewer` agents to get diverse feedback.

**IMPORTANT**: If the prompt is an orchestrator (invokes subagents), ensure reviewers check:
- Presence of complete invocation templates (CRITICAL requirement)
- Template quality and completeness
- Proper responsibility split between orchestrator and subagents

```
Task(
  subagent_type="prompt-reviewer",
  prompt="Review the following prompt:\n\n[prompt content]\n\nNote: This is an orchestrator prompt that invokes subagents. Verify invocation templates are complete and follow best practices.",
  description="Review prompt (1/3)"
)
Task(
  subagent_type="prompt-reviewer",
  prompt="Review the following prompt:\n\n[prompt content]\n\nNote: This is an orchestrator prompt that invokes subagents. Verify invocation templates are complete and follow best practices.",
  description="Review prompt (2/3)"
)
Task(
  subagent_type="prompt-reviewer",
  prompt="Review the following prompt:\n\n[prompt content]\n\nNote: This is an orchestrator prompt that invokes subagents. Verify invocation templates are complete and follow best practices.",
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
