#!/bin/sh
set -eu

# ~/.agents は agents-harness/.agents への symlink に置き換えた。
# chezmoi は実ディレクトリを symlink に置き換えるときにバックアップを残さず消すため、先に退避する。
if [ -d "$HOME/.agents" ] && [ ! -L "$HOME/.agents" ]; then
  mv -- "$HOME/.agents" "$HOME/.agents.bak-$(date +%Y%m%d%H%M%S)"
fi
