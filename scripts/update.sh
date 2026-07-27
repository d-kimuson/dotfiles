#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ensure_nix_available() {
  local nix_daemon_profile="/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh"
  local nix_daemon_bin="/nix/var/nix/profiles/default/bin"

  if command -v nix >/dev/null 2>&1; then
    return
  fi

  if [ -r "$nix_daemon_profile" ]; then
    if [[ ":$PATH:" != *":$nix_daemon_bin:"* ]]; then
      unset __ETC_PROFILE_NIX_SOURCED
    fi
    # shellcheck disable=SC1091
    source "$nix_daemon_profile"
  fi

  if ! command -v nix >/dev/null 2>&1; then
    echo "Error: nix command not found. Expected Nix at $nix_daemon_bin." >&2
    exit 1
  fi
}

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
    nix run github:nix-community/home-manager/release-26.05 -- switch --flake ~/.config/home-manager#"$(whoami)"
  fi
}

# ── main ───────────────────────────────────────────────
echo "=== dotfiles update ==="

ensure_nix_available
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
  npm:@anthropic-ai/claude-code \
  npm:@earendil-works/pi-coding-agent \
  npm:@openai/codex \
  npm:opencode-ai \
  npm:@playwright/cli \
  npm:@github/copilot \
  npm:portless \
  npm:agent-browser || \
  echo "Warning: some mise upgrades failed (newer version may be within min-release-age window)" >&2
cp "${HOME}/.config/mise/config.toml" "$MISE_CONFIG_PATH"
"$MISE_BIN" reshim

echo ""
echo "=== update complete ==="
