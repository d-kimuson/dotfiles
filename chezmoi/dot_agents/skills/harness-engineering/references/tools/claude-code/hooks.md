# Claude Code hooks

Read this file only when configuring Claude Code hooks. Hooks are an escape hatch for lifecycle automation and policy enforcement; keep ordinary project knowledge in `AGENTS.md` and deterministic reusable logic in scripts.

## Configuration

Hooks can be declared in Claude Code settings. Project hooks usually live in `.claude/settings.json`, while uncommitted overrides live in `.claude/settings.local.json`.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PROJECT_DIR}\"/.claude/hooks/check.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

Hook events, matcher semantics, handler types, and output schemas change over time. Choose an event based on the lifecycle point that must be observed, then confirm its current input and decision contract in the official reference.

Preserve the nested settings shape shown above: an event contains matcher groups, and each matcher group contains a `hooks` array of handlers. For tool events, `matcher` is a string such as `"Edit|Write"`, not an array. Do not replace this vendor schema with a generic hook shape.

## Command hook contract

Command hooks receive JSON on standard input. Common fields include `session_id`, `transcript_path`, `cwd`, `hook_event_name`, and event-specific data such as `tool_name`, `tool_input`, or `tool_response`.

- Exit `0`: success; stdout may contain a supported JSON response.
- Exit `2`: request a blocking outcome where the event supports blocking; stderr supplies the reason.
- Other non-zero exits: normally report a non-blocking hook error.

The exact effect is event-specific. A `PreToolUse` hook can block before execution, while a `PostToolUse` hook cannot undo a completed tool call.

## Implementation rules

- Keep hook configuration small and put non-trivial logic in a versioned script.
- Parse JSON with a real parser rather than shell string matching.
- Validate all hook input, quote variables, reject path traversal, and use absolute paths.
- Keep synchronous hooks fast; use asynchronous hooks only when their result does not need to block the triggering action.
- Do not rely on a hook to override an explicit permission deny or ask rule.
- Test scripts independently and inspect Claude Code debug logs when validating integration.

## Maintenance rule

Verify events and schemas against the current official reference before adding or changing a hook:

- <https://code.claude.com/docs/en/hooks>
