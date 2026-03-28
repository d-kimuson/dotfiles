#!/usr/bin/env bash

set -euo pipefail

if command -v nix &>/dev/null; then
  echo "[=] Nix is already installed"
  nix --version
  exit 0
fi

ARCH="$(uname -m)"
NIX_VERSION="${NIX_VERSION:-2.34.4}"

mkdir -p /etc/nix
cat > /etc/nix/nix.conf <<'EOF'
build-users-group =
experimental-features = nix-command flakes
EOF

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "[+] Downloading Nix ${NIX_VERSION}..."
curl --proto '=https' --tlsv1.2 -sSfL \
  --connect-timeout 15 --max-time 180 \
  "https://releases.nixos.org/nix/nix-${NIX_VERSION}/nix-${NIX_VERSION}-${ARCH}-linux.tar.xz" \
  -o "$TMP_DIR/nix.tar.xz"

tar xf "$TMP_DIR/nix.tar.xz" -C "$TMP_DIR"

echo "[+] Installing Nix..."
export USER="${USER:-$(whoami)}"
bash "$TMP_DIR"/nix-*-linux/install --no-daemon

export PATH="$HOME/.nix-profile/bin:$PATH"

echo "[+] Done!"
nix --version
