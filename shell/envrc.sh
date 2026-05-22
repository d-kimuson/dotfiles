#!/usr/bin/env bash

# ====================
# Env variables
# ====================
export STARSHIP_CONFIG=${CHEZMOI_DIR}/config/starship.toml
export DOCKER_CONFIG=$HOME/.docker
export BUN_INSTALL="$HOME/.bun"
export DIRENV_WARN_TIMEOUT=1m
export LITELLM_PORT="8082"

export CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=true
export CLAUDE_CODE_DISABLE_AUTO_MEMORY=1
export CLAUDE_CODE_DISABLE_1M_CONTEXT=1
export MCP_TIMEOUT=120000

export PNPM_HOME="$HOME/Library/pnpm"
