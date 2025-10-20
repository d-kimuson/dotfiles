# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a personal dotfiles repository that manages shell configurations, aliases, Claude Code settings, and development tools. The repository is designed to be installed at `$HOME/dotfiles` with symbolic links created to appropriate locations.

## Common Commands

### Setup and Installation
```bash
# Initial setup (run after cloning)
./scripts/sync.sh
exec $SHELL -l
mise use node@22 -g
mise use python@latest -g
./scripts/claude_code_mcp.sh
```

### Alias Manager Development
```bash
cd alias-manager
pnpm i                    # Install dependencies
pnpm build               # Build aliases to output/shell_aliases.sh
pnpm dev                 # Watch mode for development
pnpm test                # Run tests
pnpm test:watch          # Run tests in watch mode
pnpm typecheck           # TypeScript type checking
```

### Development Workflow
- After modifying alias-manager code, run `pnpm build` to regenerate `output/shell_aliases.sh`
- Changes to alias-manager must be built and committed as the setup script uses committed build artifacts
- Use `./scripts/sync.sh` to update symlinks after adding new configuration files

## Architecture

### Core Components

1. **Alias Manager** (`alias-manager/`): TypeScript-based system that generates shell aliases and functions
   - Built with `tsx` and Vitest for testing
   - Generates `output/shell_aliases.sh` which is sourced by `.zshrc`
   - Configuration defined in `src/config/` directory

2. **Shell Configuration**: 
   - `.zshrc`: Main shell configuration, sources alias manager output
   - Uses starship prompt, direnv, and mise for tool management
   - Supports local configuration via `.localrc`

3. **Claude Code Integration**: 
   - Custom commands in `claude-code/commands/`
   - Custom agents in `claude-code/agents/`
   - Settings configuration in `claude-code/settings.json`
   - Memory/guidelines in `claude-code/CLAUDE.md`

4. **Gemini CLI Integration**:
   - Custom commands in `gemini-cli/commands/`
   - Includes web-research command configuration

### File Organization

- **Configuration files**: SSH config, Starship config, Git configs
- **Scripts**: `sync.sh` for setup, `claude_code_mcp.sh` for MCP server setup
- **Tool configs**: Separate directories for each tool (claude-code, gemini-cli)

## Key Dependencies

- **System tools**: direnv, starship, mise, Claude Code, Gemini CLI, gh (GitHub CLI)
- **Node.js tools**: pnpm (package manager), tsx (TypeScript runner), vitest (testing)
- **Development**: TypeScript with strict configuration (@tsconfig/strictest)

## Important Notes

- This repository includes custom Claude Code guidelines that prefer gemini CLI over WebSearch
- The alias-manager requires manual building and committing of output files
- Setup script creates symlinks - existing files must be manually removed
- Settings file (`claude-code/settings.json`) cannot be symlinked and must be manually copied
- MCP servers (context7, serena) are configured via the setup script