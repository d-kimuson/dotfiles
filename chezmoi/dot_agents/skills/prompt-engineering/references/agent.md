# Agents Detailed Reference

## Overview
Specialized sub-agents invoked from the Task tool (Claude Code standard) or agent-task (super-agent MCP).

## Structure
- **Location**: `.claude/agents/<agent-name>.md`
- **Invocation**: `agent-task(agentType="agent-name", ...)`, `Task(subagent_type="agent-name", ...)`
- **Processing**: Frontmatter is excluded, and the body is passed as instructions

## Task vs agent-task

- Since super-agent is primarily used, templates should use the `agent-task(...)` format
- Use Task (with template) only when using Claude Code-specific features like `context: fork`
- Fallback for unavailable cases is specified separately, so no need to write it each time

## Frontmatter

`name` and `description` are required. Others are optional (uncomment as needed).

```yaml
---
name: agent-name  # Must match filename (without .md)
description: 'Brief description of the agent'
model: sonnet     # For Claude Code: haiku | sonnet | opus | inherit
color: cyan       # Display color: red | blue | green | yellow | magenta | orange | pink | cyan
# skills:         # Skills to auto-load when agent starts
#   - typescript
#   - react
# tools: Read, Grep, Glob, Bash  # Available tools (inherits all tools if omitted)
# disallowedTools: Write, Edit   # Tools to deny (removes from inheritance)
# permissionMode: default        # default | acceptEdits | dontAsk | bypassPermissions | plan
# hooks:                         # Lifecycle hooks scoped to the agent
#   PostToolUse:
#     - matcher: "Edit|Write"
#       hooks:
#         - type: command
#           command: "./scripts/run-linter.sh"
models:           # For super-agent: multi-provider support
  - sdkType: claude
    model: sonnet
  - sdkType: codex
    model: gpt-5.2
  - sdkType: copilot
    model: gpt-5.2
---
```

## Additional Field Descriptions

| Field | Description |
|-------|-------------|
| `tools` | Restricts available tools (inherits all tools if omitted) |
| `disallowedTools` | Denies specific tools from inheritance or specified list |
| `permissionMode` | Controls how permission prompts are handled |
| `hooks` | Supports `PreToolUse`, `PostToolUse`, `Stop`. See `references/hooks.md` |

### permissionMode Values

| Value | Behavior |
|-------|----------|
| `default` | Standard permission check with prompts |
| `acceptEdits` | Auto-accept file edits |
| `dontAsk` | Auto-deny permission prompts (explicitly allowed tools still work) |
| `bypassPermissions` | Skip all permission checks (use with caution) |
| `plan` | Plan mode (read-only exploration) |

## model Field (For Claude Code)

Model selection in Claude Code:
- **haiku**: Speed-focused, simple tasks
- **sonnet**: Balanced, standard tasks
- **opus**: Complex reasoning, tasks requiring high-quality output
- **inherit**: Inherits the caller's model

## models Field (For super-agent)

Specify multiple AI providers with fallback. Use array format with `sdkType` and `model`.

```yaml
models:
  - sdkType: claude
    model: opus
  - sdkType: codex
    model: gpt-5.2
  - sdkType: copilot
    model: gpt-5.2
```

### Selection Rules

Since fallback occurs when unavailable, **always specify all three: codex, copilot, and claude**.

**High-difficulty tasks like design and consultation with minimal context growth**:
```yaml
models:
  - sdkType: copilot
    model: gpt-5.2
  - sdkType: codex
    model: gpt-5.2
  - sdkType: claude
    model: opus
```

**Simple tasks requiring large context size** (such as context collection):
```yaml
models:
  - sdkType: copilot
    model: gpt-5-mini
  - sdkType: claude
    model: haiku
  - sdkType: codex
    model: gpt-5.2-mini
```

**Writing tasks** (article writing, prompt composition, etc.):
```yaml
models:
  - sdkType: claude
    model: sonnet
  - sdkType: copilot
    model: claude-sonnet-4.5
  - sdkType: codex
    model: gpt-5.2
```

**Selection Guidelines**:
- **Claude's strength**: Flexibility and writing ability
- **OpenAI Model's strength**: Pure intelligence
- **Pricing**: Copilot is cheaper (except for Opus). Prefer Copilot CLI when the same model is available

## skills Field
- Skills listed here are auto-loaded when the agent is invoked
- No need for manual `Skill(...)` calls or "enable X skill" instructions in the body
- Use for skills the agent **always** needs (not conditional ones)
- For dynamic/conditional skill loading, use `Skill(...)` tool in the prompt body

## Target Audience
Both the caller (orchestrator LLM) and executor (sub-agent LLM) are LLMs.

## Design Principles

### Single Responsibility
- Each agent has one clearly defined responsibility
- Do not mix multiple concerns
- ✅ Agent A: Environment setup only
- ✅ Agent B: Code implementation only

### Independence from Caller
- Do not include orchestrator concerns (when to call, what to do with output)
- Focus on capability provision and input/output contract
- ✅ "Analyze the provided code and identify issues..."
- ✅ "Design implementation approach based on instructions..."

### Generic Within Domain
- Do not make too task-specific
- ✅ `name: engineer` (orchestrator specifies the concrete task)

## Good Example
```markdown
---
name: reviewer
description: 'Review code changes and identify issues'
model: sonnet
color: yellow
skills:
  - typescript
models:
  - sdkType: claude
    model: sonnet
  - sdkType: copilot
    model: claude-sonnet-4.5
  - sdkType: codex
    model: gpt-5.2
---

Review code changes for quality and correctness.

Check items:
- Type safety and correctness
- Security vulnerabilities
- Performance issues
- Code style consistency
- Test coverage adequacy

Report format:
- Severity level (critical/moderate/minor)
- File path and line number
- Specific recommendations
- Priority order (critical first)
```
