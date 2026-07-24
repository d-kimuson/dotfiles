# Claude Code permissions

Read this file only when configuring Claude Code. Permission syntax and settings locations are vendor-specific and must not shape the portable harness.

## Configuration

Permission rules use `Tool` or `Tool(specifier)` and live under `permissions.allow`, `permissions.ask`, or `permissions.deny` in Claude Code settings.

```json
{
  "permissions": {
    "allow": ["Bash(npm run test *)"],
    "ask": ["Bash(git push *)"],
    "deny": ["Read(//**/.env)"]
  }
}
```

Common locations are:

- `~/.claude/settings.json` for user settings;
- `.claude/settings.json` for shared project settings;
- `.claude/settings.local.json` for uncommitted project-local settings.

Rules are evaluated in the order deny, ask, then allow. A match at an earlier level cannot be overridden by a later one.

## Matching rules

- `Bash` or `Bash(*)` matches every Bash invocation.
- `Bash(npm run build)` matches the exact command.
- `Bash(npm run test *)` matches that command prefix at a word boundary.
- `Read(/src/**)` anchors to the project root when written in project settings.
- `Read(~/path/**)` anchors to the home directory.
- `Read(//absolute/path/**)` anchors to the filesystem root.
- `WebFetch(domain:example.com)` matches the exact hostname.
- MCP tools use names such as `mcp__server__tool`.

Bash patterns are convenience filters, not a security boundary. Shell composition, wrappers, variables, and future parser changes can invalidate assumptions. Use deny rules and sandboxing together for defense in depth, and prefer narrowly scoped capabilities.

## Maintenance rule

Claude Code changes this syntax independently of Agent Skills and `AGENTS.md`. Verify non-trivial rules against the current official documentation before committing them:

- <https://code.claude.com/docs/en/permissions>
