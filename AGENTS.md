# AGENTS.md (chezmoi)

This repository manages dotfiles whose content is either shared across machines or rendered per machine through chezmoi templates.
It uses home-manager for standard development tools, mise for npm-distributed CLIs and runtimes, and custom delivery mechanisms for MCP and Coding Agent configuration.

A configuration change is complete only after its source or delivery configuration is updated, its applicable delivery path is run, and the result is verified.
Always use the project-scoped `chezmoi` skill when changing, validating, or applying chezmoi, home-manager, mise, or shell configuration.

## References

The following references are separated for on-demand reading, but they contain important operational information.
Always read every reference relevant to the change before making it.

- [Architecture](docs/overview.md)
- [chezmoi Operations](docs/chezmoi.md)
- [Tool Management](docs/tool-management.md)
- [MCP Configuration Delivery](docs/mcp.md)
- [Coding Agent Configuration Delivery](docs/coding-agents.md)
- [Commands](docs/commands.md)
