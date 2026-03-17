#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── beads ──────────────────────────────────────────────
update_beads() {
  local pkg_file="$REPO_ROOT/chezmoi/private_dot_config/home-manager/packages/beads.nix"
  local current_version
  current_version=$(grep 'version = ' "$pkg_file" | head -1 | sed 's/.*"\(.*\)".*/\1/')

  echo "beads: checking for updates (current: v${current_version})..."

  local latest_version
  latest_version=$(gh release view --repo steveyegge/beads --json tagName -q '.tagName' | sed 's/^v//')

  if [ "$current_version" = "$latest_version" ]; then
    echo "beads: already up to date (v${current_version})"
    return 0
  fi

  echo "beads: updating v${current_version} -> v${latest_version}"

  # Prefetch source hash
  local src_hash
  src_hash=$(nix-prefetch-url --unpack --type sha256 \
    "https://github.com/steveyegge/beads/archive/refs/tags/v${latest_version}.tar.gz" 2>/dev/null)
  src_hash=$(nix hash convert --hash-algo sha256 --to sri "$src_hash")

  # Update version and source hash
  sed -i '' "s|version = \"${current_version}\"|version = \"${latest_version}\"|" "$pkg_file"
  sed -i '' "s|hash = \".*\"|hash = \"${src_hash}\"|" "$pkg_file"

  # Determine vendorHash by building with empty hash and extracting from error
  sed -i '' 's|vendorHash = ".*"|vendorHash = ""|' "$pkg_file"

  echo "beads: computing vendorHash (this may take a moment)..."
  local build_output
  # chezmoi apply first so home-manager sees the updated file
  chezmoi apply 2>/dev/null || true
  build_output=$(cd ~/.config/home-manager && home-manager switch 2>&1 || true)

  local vendor_hash
  vendor_hash=$(echo "$build_output" | grep -oE 'sha256-[A-Za-z0-9+/]+=*' | tail -1)

  if [ -z "$vendor_hash" ]; then
    echo "beads: ERROR: could not determine vendorHash. Reverting changes."
    git -C "$REPO_ROOT" checkout -- "$pkg_file"
    return 1
  fi

  sed -i '' "s|vendorHash = \".*\"|vendorHash = \"${vendor_hash}\"|" "$pkg_file"
  echo "beads: updated to v${latest_version}"
}

# ── nix flake ──────────────────────────────────────────
update_flake() {
  echo "flake: updating inputs..."
  cd ~/.config/home-manager
  nix flake update
}

# ── main ───────────────────────────────────────────────
echo "=== dotfiles update ==="

update_beads
chezmoi apply 2>/dev/null || true
update_flake

echo ""
echo "Applying home-manager switch..."
cd ~/.config/home-manager && home-manager switch

echo ""
echo "=== update complete ==="
