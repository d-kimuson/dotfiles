## Commands Detailed Reference

### Overview
Reusable instruction presets invoked by users with `/command-name [args]`.

### Structure
- **Location**: `.claude/commands/<command-name>.md`
- **Invocation**: `/command-name [additional instructions]`
- **Processing**: Frontmatter is excluded, and the body is passed as instructions

### Frontmatter

```yaml
---
description: 'Description of when to use this command (required, 80 characters or less, in the repository's primary language)'
disable-model-invocation: true  # Required: Prevents automatic invocation by agents
user-invocable: true            # Required: Shows in user's / menu
# argument-hint: '[issue-number]'   # Hint shown in autocomplete
# allowed-tools: Read, Grep, Glob   # Tools allowed without permission during command execution (see references/permission-syntax.md for syntax)
# model: sonnet                     # Model to use during command execution
# context: fork                     # fork executes in sub-agent context
# agent: github                     # Sub-agent type to use when context: fork
# hooks:                            # Hooks scoped to the command lifecycle
#   PreToolUse:
#     - matcher: "Bash"
#       hooks:
#         - type: command
#           command: "./scripts/validate.sh"
---
```

### Required Frontmatter Fields

| Field | Value | Description |
|-------|-------|-------------|
| `description` | string | Description of command purpose (80 characters or less) |
| `disable-model-invocation` | `true` | Prevents automatic invocation by agents |
| `user-invocable` | `true` | Shows command in `/` menu |

**Commands are designed to always be user-initiated**. Things that agents should invoke automatically should be defined as Agents or Skills.

### Other Field Descriptions

| Field | Purpose |
|-------|---------|
| `context: fork` | Isolated execution in sub-agent. Use with `agent` to delegate to an agent |
| `agent` | Agent name to use when `context: fork` |
| `hooks` | Supports `PreToolUse`, `PostToolUse`, `Stop`. See `references/hooks.md` |

### description Field
- **Core content**: When to use this command (no "When to use:" prefix needed)
- **Language**: Written in the project's primary language
- **Length**: 80 characters or less

### allowed-tools Field
See `references/permission-syntax.md` for permission syntax details.

**Default allowed tools (can be omitted)**: `TodoWrite`, `Task`, `Glob`, `Grep`, `Read`

### Variable Substitution

The following variables are available in the command body:

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | Arguments passed when invoking the command. `/fix-issue 123` → `$ARGUMENTS` is `123` |

If `$ARGUMENTS` is not present in the body, arguments are automatically appended as `ARGUMENTS: <value>` at the end.

### Target Audience
- `description` → Users (project language)
- Body → LLM worker

### Design Principles

### Single Responsibility
Commands should execute one clear task.
- ✅ `/format` - Code formatting
- ✅ `/test` - Test execution

### Conciseness
- Include only information necessary for execution
- Remove verbose explanations
- Omit what the LLM can infer

### Choosing Between Command and Skill

| Aspect | Command | Skill |
|--------|---------|-------|
| Invoker | User (explicit with `/`) | Agent (automatic judgment) + User |
| `disable-model-invocation` | `true` (required) | `false` (required) |
| Purpose | Task execution | Knowledge/guideline provision |

**Decision criteria**: Task explicitly invoked by user → Command, Knowledge activated by agent based on situation → Skill

### Good Example

**Filename**: `.claude/commands/review-changes.md`

```markdown
---
description: 'When you need to review code changes'
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash(git), Read(*), Grep
---

Review changes on the current branch.

Check items:
- Type safety
- Security issues
- Performance concerns
- Test coverage

Output format:
- List issues by severity
- Include specific improvement suggestions
```
