### Permission Rule Syntax

Permission rules follow the format `Tool` or `Tool(specifier)`. Understanding the syntax helps create rules that match exactly what you intend.

#### Rule Evaluation Order

When multiple rules may match the same tool use, rules are evaluated in this order:

1. **Deny** rules are checked first
2. **Ask** rules are checked second
3. **Allow** rules are checked last

The first matching rule determines the behavior. This means a deny rule always takes precedence over an allow rule, even if both match the same command.

#### Matching All Uses of a Tool

To match all uses of a tool, use the tool name without parentheses:

| Rule       | Effect                                |
| :--------- | :------------------------------------ |
| `Bash`     | Matches **all** Bash commands         |
| `WebFetch` | Matches **all** web fetch requests    |
| `Read`     | Matches **all** file reads            |

<Warning>
  `Bash(*)` does **not** match all Bash commands. The `*` wildcard only matches within the specifier context. To allow or deny all uses of a tool, use just the tool name: `Bash`, not `Bash(*)`.
</Warning>

#### Using Specifiers for Fine-Grained Control

Add a specifier in parentheses to match specific tool uses:

| Rule                           | Effect                                         |
| :----------------------------- | :--------------------------------------------- |
| `Bash(npm run build)`          | Matches exact command `npm run build`          |
| `Read(./.env)`                 | Matches reading `.env` file in current directory |
| `WebFetch(domain:example.com)` | Matches fetch requests to example.com          |

#### Wildcard Patterns

Two wildcard syntaxes are available for Bash rules:

| Wildcard | Position              | Behavior                                                              | Example                                               |
| :------- | :-------------------- | :-------------------------------------------------------------------- | :---------------------------------------------------- |
| `:*`     | End of pattern only   | **Prefix matching** (with word boundary). Prefix must be followed by space or end of string. | `Bash(ls:*)` matches `ls -la` but not `lsof` |
| `*`      | Anywhere in pattern   | **Glob matching** (no word boundary). Matches any character sequence at that position. | `Bash(ls*)` matches both `ls -la` and `lsof` |

**Prefix Matching with `:*`**

The `:*` suffix matches commands starting with the specified prefix. This works with multi-word commands. The following configuration allows npm and git commit commands while blocking git push and rm -rf:

```json  theme={null}
{
  "permissions": {
    "allow": [
      "Bash(npm run:*)",
      "Bash(git commit:*)",
      "Bash(docker compose:*)"
    ],
    "deny": [
      "Bash(git push:*)",
      "Bash(rm -rf:*)"
    ]
  }
}
```

**Glob Matching with `*`**

The `*` wildcard can appear at the start, middle, or end of patterns. The following configuration allows all git commands targeting main (`git checkout main`, `git merge main`, etc.) and all version check commands (`node --version`, `npm --version`, etc.):

```json  theme={null}
{
  "permissions": {
    "allow": [
      "Bash(git * main)",
      "Bash(* --version)"
    ]
  }
}
```

<Warning>
  Bash permission patterns that attempt to restrict command arguments are fragile. For example, `Bash(curl http://github.com/:*)` is intended to restrict curl to GitHub URLs, but won't match `curl -X GET http://github.com/...` (flags before URL), `curl https://github.com/...` (different protocol), or commands using shell variables. Do not rely on argument constraint patterns as a security boundary. See [Bash Permission Limitations](/iam#tool-specific-permission-rules) for alternatives.
</Warning>

For more information on tool-specific permission patterns (including Read, Edit, WebFetch, MCP, Task rules, and Bash permission limitations), see [Tool-Specific Permission Rules](/iam#tool-specific-permission-rules).
