## Skills Detailed Reference

### Overview
Reusable knowledge and guidelines loaded into sessions.

### Structure
- **Location**: `${.claude,.github,.codex,.gemini}/skills/<skill-name>/SKILL.md`
- **Invocation**: Skill tool or automatic loading based on description
- **Processing**: Frontmatter is excluded, body is injected into context

### Frontmatter

```yaml
---
name: skill-name                    # Uses directory name if omitted. Lowercase, numbers, hyphens only (max 64 chars)
description: 'When to enable this skill'  # Recommended. Uses first paragraph of body if omitted
disable-model-invocation: false     # Required: Allow automatic invocation from agents
user-invocable: true                # Required: Show in / menu (document reason if setting to false)
# argument-hint: '[issue-number]'   # Hint displayed during autocomplete
# allowed-tools: Read, Grep, Glob   # Tools that can be used without permission when skill is active (see references/permission-syntax.md for syntax)
# model: sonnet                     # Model to use when skill is active
# context: fork                     # fork to run in subagent context
# agent: Explore                    # Subagent type to use when context: fork
# hooks:                            # Hooks scoped to skill lifecycle
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
| `disable-model-invocation` | `false` | Allow automatic invocation from agents |
| `user-invocable` | `true` / `false` | Controls display in `/` menu |

**Skills are expected to be auto-loaded by agents as needed**. `disable-model-invocation: false` allows the agent to enable based on its judgment.

### Choosing user-invocable Values

| Value | Use Case |
|-------|----------|
| `true` (default) | Skills that users may explicitly enable |
| `false` | Background knowledge, internal skills, reference-only from other prompts |

### Other Field Explanations

| Field | Purpose |
|-------|---------|
| `context: fork` | Isolated execution in subagent. Only effective for skills containing explicit task instructions |
| `hooks` | Supports `PreToolUse`, `PostToolUse`, `Stop`. See `references/hooks.md` |

### Target Audience
Any LLM (main session, orchestrator, subagent)

### Design Principles
- **Grant knowledge and capabilities**, not workflow orchestration
- Principles, best practices, rules (not "first do X, then Y")
- Content that is reproducible and has stable interpretation

### Choosing Between Command and Skill

| Aspect | Command | Skill |
|--------|---------|-------|
| Invoker | User (explicit via `/`) | Agent (automatic judgment) + User |
| `disable-model-invocation` | `true` (required) | `false` (required) |
| Purpose | Task execution | Knowledge/guideline provision |

**Decision Criteria**: Task that user explicitly invokes → Command, Knowledge that agent enables based on context → Skill

### Good Examples

#### Standard (`user-invocable: true`)

```markdown
---
name: typescript
description: 'Enable when writing or reviewing TypeScript code'
disable-model-invocation: false
user-invocable: true
---

## Type Safety Principles
- Avoid `any`, prefer `unknown`
- Omit explicit type annotations when inference is sufficient
- Leverage union types and discriminated unions

## Error Handling
- Use Result type pattern (explicit return values over exceptions)
- Define custom error types for type-safe error handling
```

#### Internal Use (`user-invocable: false`)

Auxiliary skills referenced from other prompts, for background knowledge.

```markdown
---
name: legacy-api-context
description: 'Internal knowledge about legacy API'
disable-model-invocation: false
user-invocable: false
---

## Legacy API Constraints
- v1 endpoints are deprecated, use v2
- Auth tokens are sent via X-Legacy-Auth header
- Rate limit: 100 req/min
```
