#!/usr/bin/env bash

# ====================
# alias
# ====================
source ${CHEZMOI_WORKING_TREE}/shell/alias.sh

# ====================
# Env variables
# ====================
source ${CHEZMOI_WORKING_TREE}/shell/envrc.sh

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

if [ -s "${CHEZMOI_WORKING_TREE}/shell/env-secrets.sh" ]; then
  source "${CHEZMOI_WORKING_TREE}/shell/env-secrets.sh"
fi
