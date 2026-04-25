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

# ── main ───────────────────────────────────────────────
echo "=== dotfiles update ==="

chezmoi apply 2>/dev/null || true
update_flake

echo ""
echo "Applying home-manager switch..."
cd ~/.config/home-manager && home-manager switch

echo ""
echo "=== update complete ==="
