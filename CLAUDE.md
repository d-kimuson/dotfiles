# CLAUDE.md (chezmoi)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a dotfiles repository managed with **chezmoi** and **home-manager (Nix)**. The repository manages shell configurations, development tool settings, and AI coding assistant configurations.

## Repository Structure

```
.chezmoiroot           # Points to `chezmoi/` as the source directory
chezmoi/               # chezmoi source files (deployed to $HOME)
  dot_claude/          # Claude Code configuration (~/.claude/)
  dot_zshrc.tmpl       # Shell entry point
  private_dot_config/  # Config files (~/.config/)
    home-manager/      # home.nix template
    mise/              # mise (asdf successor) config
shell/                 # Shared shell scripts (sourced from .zshrc)
  alias.sh             # Shell aliases and functions
  sharedrc.sh          # Shared shell configuration
scripts/               # Setup and maintenance scripts
config/                # Non-dotfile configs (starship, MCP)
```

## Commands

### Initial Setup (new machine)
```bash
bash -c "$(curl -fsLS https://raw.githubusercontent.com/d-kimuson/dotfiles/refs/heads/main/scripts/setup.sh)"
```

### Apply Configuration Changes
```bash
./scripts/reload.sh   # Runs chezmoi apply + home-manager switch + shell reload
```

### Individual Commands
```bash
chezmoi apply         # Apply chezmoi-managed dotfiles
home-manager switch   # Apply Nix home-manager configuration
```

## Key Concepts

### chezmoi Templating
Files with `.tmpl` extension use Go templates with chezmoi data (e.g., `{{ .chezmoi.username }}`). OS-specific logic is handled via templates (see `dot_zshrc.tmpl` for Linux/Ubuntu conditionals).

### Package Management
- **home-manager (Nix)**: System packages defined in `chezmoi/private_dot_config/home-manager/home.nix.tmpl`
- **mise**: Runtime version management for Node.js etc. (config in `chezmoi/private_dot_config/mise/config.toml`)

### Shell Configuration Flow
1. `.zshrc` sources `shell/sharedrc.sh`
2. `sharedrc.sh` sources `shell/alias.sh` and sets up PATH, environment variables, and tool activations (mise, starship, direnv)
3. Optional `shell/localrc.sh` for machine-specific overrides (gitignored)

## Editing Rules

### Always edit chezmoi source files, never target files directly
Do not edit `~/.zshrc`, `~/.config/*`, or any other managed dotfiles directly. Always edit the corresponding source files under `chezmoi/` and run `./scripts/reload.sh` to apply.

### Prefer nixpkgs for adding dependencies
When adding new dependencies, add them to `chezmoi/private_dot_config/home-manager/home.nix.tmpl` and manage via home-manager. Always check nixpkgs availability before resorting to npm global installs or manual downloads.

```bash
# Search for a package (first run is slow due to cache building)
nix search nixpkgs <package-name>

# Example: search for ripgrep
nix search nixpkgs ripgrep
# => legacyPackages.aarch64-darwin.ripgrep (15.1.0)

# Add to home.nix.tmpl as: pkgs.ripgrep
```

Use the last segment of the attribute path as the package name (e.g., `legacyPackages.aarch64-darwin.ripgrep` → `pkgs.ripgrep`).
