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

export CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=true
export CLAUDE_CODE_DISABLE_AUTO_MEMORY=1
export CLAUDE_CODE_DISABLE_1M_CONTEXT=1
export MCP_TIMEOUT=120000

export NODE_EXTRA_CA_CERTS=/tmp/portless/ca.pem

export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# home-manager session variables (e.g. PKG_CONFIG_PATH)
if [ -s "${HOME}/.nix-profile/etc/profile.d/hm-session-vars.sh" ]; then
  source "${HOME}/.nix-profile/etc/profile.d/hm-session-vars.sh"
fi

# ====================
# Activate tools
# ====================
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
  ${HOME}/.npm-global/bin
  ${HOME}/.local/share/chezmoi/shell/bin
  ${HOME}/.local/bin
)

# ====================
# Local overrides
# ====================
if [ -s "${CHEZMOI_WORKING_TREE}/shell/localrc.sh" ]; then
  source "${CHEZMOI_WORKING_TREE}/shell/localrc.sh"
fi
