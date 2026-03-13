#!/usr/bin/env bash

set -euo pipefail

CWD=$(pwd)

log_info() {
  echo ""
  echo "========================================"
  echo "[INFO] $1"
  echo "========================================"
}

install_if_not_exists() {
  local cmd="$1"
  local installer="$2"

  if ! command -v "$cmd" &>/dev/null; then
    echo "[+] Installing $cmd..."
    eval "$installer"
  else
    echo "[=] $cmd is already installed"
  fi
}

cd $HOME

log_info "Starting dotfiles setup..."

# install chezmoi and nix
install_if_not_exists chezmoi 'sh -c "$(curl -fsLS get.chezmoi.io)"'
install_if_not_exists nix 'sh <(curl -L https://nixos.org/nix/install) --yes --daemon'

# initialize chezmoi
$HOME/bin/chezmoi init --apply https://github.com/d-kimuson/dotfiles.git
$HOME/bin/chezmoi apply

# setup home-manager
nix run home-manager/master -- switch

# nix profile で直接管理するパッケージ
# home-manager 経由だと nixpkgs 更新時にソースビルドが走り得るため、
# ビルドが重いパッケージは nix profile で分離し、任意のタイミングで更新する
nix profile add nixpkgs#zed-editor

cd $CWD

log_info "Setup completed!"
echo ""
echo "To apply the new shell configuration, run:"
echo ""
echo "    exec \$SHELL -l"
echo ""
