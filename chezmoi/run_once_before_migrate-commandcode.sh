#!/bin/sh
set -eu

# Command Code の import で作られた複製を消し、chezmoi 管理の symlink に置き換える。
# 既に symlink になっている場合は再実行しても触らない。
if [ -d "$HOME/.commandcode/skills" ] && [ ! -L "$HOME/.commandcode/skills" ]; then
  rm -rf -- "$HOME/.commandcode/skills"
fi
if [ -d "$HOME/.commandcode/commands" ] && [ ! -L "$HOME/.commandcode/commands" ]; then
  rm -rf -- "$HOME/.commandcode/commands"
fi
if [ -f "$HOME/.commandcode/AGENTS.md" ] && [ ! -L "$HOME/.commandcode/AGENTS.md" ]; then
  rm -f -- "$HOME/.commandcode/AGENTS.md"
fi

# OpenCode の skills も ~/.agents/skills に集約する。既存の実ディレクトリは退避する。
if [ -d "$HOME/.config/opencode/skills" ] && [ ! -L "$HOME/.config/opencode/skills" ]; then
  mv -- "$HOME/.config/opencode/skills" "$HOME/.config/opencode/skills.bak"
fi
