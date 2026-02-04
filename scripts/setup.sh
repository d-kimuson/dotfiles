#!/usr/bin/env bash

set -euo pipefail

CHEZMOI_DIR=$HOME/.local/share/chezmoi

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

# create chezmoi directory
mkdir -p $CHEZMOI_DIR
cd $CHEZMOI_DIR

# install chezmoi and nix
install_if_not_exists chezmoi 'sh -c "$(curl -fsLS get.chezmoi.io)"'
install_if_not_exists nix 'sh <(curl -L https://nixos.org/nix/install) --yes --daemon'

# initialize chezmoi
./bin/chezmoi init --apply git@github.com:d-kimuson/dotfiles.git
./bin/chezmoi apply

# initialize home-manager
nix run home-manager/master -- init --switch

# switch home-manager
home-manager switch

# chsh -s $(which zsh)
