#!/usr/bin/env bash

# ====================
# alias
# ====================
source ${CHEZMOI_WORKING_TREE}/shell/alias.sh

# ====================
# Env variables
# ====================
export STARSHIP_CONFIG=${CHEZMOI_DIR}/config/starship.toml
export DOCKER_CONFIG=$HOME/.docker
export BUN_INSTALL="$HOME/.bun"
export DIRENV_WARN_TIMEOUT=1m
export LITELLM_PORT="8082"

export CLAUDE_CODE_VERSION=2.1.19
export CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=true
export MCP_TIMEOUT=120000

export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# ====================
# Activate tools
# ====================
eval "$(mise activate --shims)"
eval "$(starship init zsh)"
eval "$(direnv hook zsh)"
if [ -s "/Users/kaito/.bun/_bun" ]; then
  source "/Users/kaito/.bun/_bun"
fi

# ====================
# SET PATH
# ====================
path=(
  ${HOME}/.nix-profile/bin # home-manager を最優先
  ${path:#${HOME}/.nix-profile/bin}
  ${HOME}/bin
  $BUN_INSTALL/bin
)
