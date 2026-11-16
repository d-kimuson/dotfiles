#!/usr/bin/env bash
# Links the tool-specific locations of a repository to its .agents/skills and .agents/prompts.
# Codex, Pi, and Command Code read .agents/skills natively, so only Claude Code needs a skills link.
#
#   link-tools.sh [root]   root defaults to the git top level, else the current directory
#
# An existing link to the same target is left as it is. Anything else at a link's path is reported
# and left untouched, and the script exits with 1.
set -eu

root=${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}
cd "$root"

status=0

link() {
  local path=$1 target=$2
  if [ -L "$path" ] && [ "$(readlink "$path")" = "$target" ]; then
    echo "ok        $path -> $target"
  elif [ -e "$path" ] || [ -L "$path" ]; then
    echo "conflict  $path exists; move its contents into .agents and remove it" >&2
    status=1
  else
    mkdir -p "$(dirname "$path")"
    ln -s "$target" "$path"
    echo "linked    $path -> $target"
  fi
}

if [ -d .agents/skills ]; then
  link .claude/skills ../.agents/skills
fi

if [ -d .agents/prompts ]; then
  link .claude/commands ../.agents/prompts
  link .pi/prompts ../.agents/prompts
  link .commandcode/commands ../.agents/prompts
fi

exit "$status"
