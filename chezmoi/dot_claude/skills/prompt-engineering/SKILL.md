---
name: prompt-engineering
description: Best practices for prompt engineering and context engineering for Coding Agent prompts
disable-model-invocation: false
user-invocable: true
---

Guidelines for creating and editing Coding Agent prompts (commands, agents, skills, context files).

**Important**: Always Read the detailed reference for the corresponding prompt type before starting work.

## Prompt Type Quick Reference

| Type | Location | Invocation | Purpose | Reference |
|------|----------|------------|---------|-----------|
| **Command** | `.claude/commands/<name>.md` | `/command-name` | Reusable tasks for users | `references/command.md` |
| **Agent** | `.{.super-agent,.claude}/agents/<name>.md` | `@agent-name` / Task tool | Specialized subagents | `references/agent.md` |
| **Skill** | `{.super-agent|.claude|.codex|.github}/skills/<name>/SKILL.md` | Skill tool / automatic | Reusable knowledge and guidelines | `references/skill.md` |
| **Context File** | `.claude/CLAUDE.md` etc. | Auto-loaded | Always-needed project context | `references/context-file.md` |
| **Document** | Any | Manual reference | Standalone prompts | - |

**Other references**:
- `references/orchestration.md` - Orchestrator design for calling subagents
- `references/permission-syntax.md` - Permission syntax for allowed-tools
- `references/hooks.md` - Lifecycle hook configuration

## Core Principles

### 1. Single Responsibility
Each prompt has one clear purpose.
- ✅ Environment setup only / Code implementation only

### 2. Independence from Caller
Avoid references to "orchestrator" or "parent task"; focus on input/output contracts.
- ✅ "Analyze the provided code and identify issues..."

### 3. Conciseness
Only information necessary for execution. Remove verbose examples, hypothetical paths, and generic patterns.

### 4. Noise Avoidance
- Avoid examples in multiple languages (choose the primary language)
- Avoid hypothetical file paths (CONTRIBUTING.md, etc.)
- Omit detailed steps that the LLM can infer

## Formatting Rules

- **No h1 headings**: Do not start with `#`
- **Language**: `description` in the project's primary language; body can also be in primary language
- **XML tags**: Use for structuring when there are multiple sections

## Orchestration

When calling subagents:
1. **Invocation template required**: Include complete Task tool usage example
2. **Responsibility separation**: Subagents should be generic; task-specific details go in templates

## Special Rules for Context Files

Be especially careful since they are always loaded:
- **80% rule**: Only information needed by 80% of tasks
- **Index-first**: Reference details via pointers
- **Scrutinize commands**: Only commands the LLM will autonomously execute
- **Target under 200 lines**
