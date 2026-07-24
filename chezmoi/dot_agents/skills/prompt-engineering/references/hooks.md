# Hooks Detailed Reference

## Overview
Custom commands executed before/after tool execution or during session lifecycle.
Can be defined in Agents or Skills frontmatter, or in settings.json.

## Configuration Locations

| Location | Scope |
|----------|-------|
| `~/.claude/settings.json` | User-wide |
| `.claude/settings.json` | Project shared |
| `.claude/settings.local.json` | Project local |
| Agent/Skill frontmatter | Only while that component is active |

## Event Types

### Events Using Matchers

| Event | Execution Timing | Matcher Target |
|-------|------------------|----------------|
| `PreToolUse` | Before tool invocation | Tool name |
| `PostToolUse` | After tool invocation | Tool name |
| `PermissionRequest` | When permission dialog is shown | Tool name |
| `Notification` | When notification is sent | Notification type |

### Events Without Matchers

| Event | Execution Timing |
|-------|------------------|
| `UserPromptSubmit` | When user prompt is submitted (before processing) |
| `Stop` | When main agent response ends |
| `SubagentStop` | When subagent response ends |
| `SessionStart` | When session starts or resumes |
| `SessionEnd` | When session ends |
| `PreCompact` | Before compact operation |

## Configuration Format

### Configuration in settings.json

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/lint.sh",
            "timeout": 30
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/cleanup.sh"
          }
        ]
      }
    ]
  }
}
```

### Configuration in Agent/Skill Frontmatter

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate.sh"
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/lint.sh"
```

Events available for Agent/Skill: `PreToolUse`, `PostToolUse`, `Stop`

## Matcher Syntax

- Simple string: `Write` → Write tool only
- Regular expression: `Edit|Write`, `Notebook.*`
- Match all: `*` or empty string `""`

## Hook Input (stdin JSON)

Common fields for all events:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/directory",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse"
}
```

### Additional Fields for PreToolUse / PostToolUse

```json
{
  "tool_name": "Write",
  "tool_input": { "file_path": "/path/to/file.txt", "content": "..." },
  "tool_use_id": "toolu_01ABC123..."
}
```

PostToolUse additionally includes `tool_response`.

## Exit Codes

| Code | Behavior |
|------|----------|
| `0` | Success. Process stdout (JSON or text) |
| `2` | Block. Use stderr as error message |
| Other | Non-blocking error. Display stderr and continue |

### Exit Code 2 Behavior (by Event)

| Event | Behavior |
|-------|----------|
| `PreToolUse` | Block tool invocation, display stderr to Claude |
| `PermissionRequest` | Deny permission, display stderr to Claude |
| `PostToolUse` | Display stderr to Claude (tool already executed) |
| `UserPromptSubmit` | Block prompt processing, display stderr to user |
| `Stop` / `SubagentStop` | Block stop, display stderr to Claude |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAUDE_PROJECT_DIR` | Absolute path to project root |
| `CLAUDE_ENV_FILE` | SessionStart only. File path for persisting environment variables |

## Common Patterns

### Enforcing Read-only Queries

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/validate-readonly.sh"
          }
        ]
      }
    ]
  }
}
```

validate-readonly.sh:
```bash
#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -iE '\b(INSERT|UPDATE|DELETE|DROP)\b' > /dev/null; then
  echo "Blocked: Only SELECT queries are allowed" >&2
  exit 2
fi
exit 0
```

### Auto-lint After File Edits

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "npm run lint --fix"
          }
        ]
      }
    ]
  }
}
```
