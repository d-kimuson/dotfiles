#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── nix flake ──────────────────────────────────────────
update_flake() {
  echo "flake: updating inputs..."
  cd ~/.config/home-manager
  nix flake update
}

remove_migrated_profile_packages() {
  local packages=(direnv mise zed-editor)

  for pkg in "${packages[@]}"; do
    if nix profile remove "${pkg}" >/dev/null 2>&1; then
      echo "Removed migrated profile package: ${pkg}"
    fi
  done
}

home_manager_switch() {
  if command -v home-manager >/dev/null 2>&1; then
    cd ~/.config/home-manager && home-manager switch
  else
    nix run home-manager/master -- switch --flake ~/.config/home-manager#"$(whoami)"
  fi
}

# ── main ───────────────────────────────────────────────
echo "=== dotfiles update ==="

chezmoi apply 2>/dev/null || true
update_flake
remove_migrated_profile_packages

echo ""
echo "Applying home-manager switch..."
home_manager_switch

echo ""
echo "Updating mise tools..."
MISE_BIN="${HOME}/.nix-profile/bin/mise"
MISE_CONFIG_PATH="${REPO_ROOT}/chezmoi/private_dot_config/mise/config.toml"
if [ ! -x "$MISE_BIN" ]; then
  MISE_BIN="$(command -v mise)"
fi
export PATH="$(dirname "$MISE_BIN"):$PATH"
"$MISE_BIN" upgrade --bump -y \
  npm:@mariozechner/pi-coding-agent \
  npm:@openai/codex \
  npm:@playwright/cli \
  npm:@github/copilot \
  npm:vite-plus
cp "${HOME}/.config/mise/config.toml" "$MISE_CONFIG_PATH"
"$MISE_BIN" reshim

echo ""
echo "=== update complete ==="
