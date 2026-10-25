#!/usr/bin/env bash
set -u

MODE="sync"
DRY_RUN=0
TOOL="all"
ROOT=""

usage() {
  cat <<'EOF'
Usage: sync-harness.sh [options]

Options:
  --check          Report only; exit 1 when a link is missing or conflicting
  --dry-run        Show what would be created without changing files
  --tool <name>    all | claude | command-code | pi | opencode | cursor
  --root <path>    Project root (default: git root, else current directory)
  -h, --help       Show this help
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --check) MODE="check" ;;
    --dry-run) DRY_RUN=1 ;;
    --tool)
      if [ $# -lt 2 ]; then
        echo "--tool requires a value" >&2
        exit 2
      fi
      TOOL="$2"
      shift
      ;;
    --root)
      if [ $# -lt 2 ]; then
        echo "--root requires a value" >&2
        exit 2
      fi
      ROOT="$2"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

case "$TOOL" in
  all|claude|command-code|pi|opencode|cursor) ;;
  *)
    echo "Invalid --tool: $TOOL" >&2
    exit 2
    ;;
esac

if [ -z "$ROOT" ]; then
  if ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
    :
  else
    ROOT=$(pwd)
  fi
fi

if ! ROOT=$(cd "$ROOT" 2>/dev/null && pwd -P); then
  echo "Project root not found: $ROOT" >&2
  exit 2
fi

ok_count=0
linked_count=0
missing_count=0
conflict_count=0
skipped_count=0

print_section() {
  printf '\n[%s]\n' "$1"
}

print_status() {
  printf '%-10s %s\n' "$1" "$2"
}

tool_enabled() {
  [ "$TOOL" = "all" ] || [ "$TOOL" = "$1" ]
}

check_link() {
  local target="$1"
  local desired="$2"
  local label="$3"

  if [ -L "$target" ]; then
    local actual
    actual=$(readlink "$target" 2>/dev/null || true)
    if [ "$actual" = "$desired" ]; then
      print_status ok "$label -> $desired"
      ok_count=$((ok_count + 1))
      return 0
    fi

    local parent target_real desired_real
    parent=$(dirname "$target")
    target_real=$(cd "$target" 2>/dev/null && pwd -P 2>/dev/null || true)
    desired_real=$(cd "$parent/$desired" 2>/dev/null && pwd -P 2>/dev/null || true)
    if [ -n "$target_real" ] && [ "$target_real" = "$desired_real" ]; then
      print_status ok "$label -> $actual (equivalent)"
      ok_count=$((ok_count + 1))
      return 0
    fi

    print_status conflict "$label is a symlink to $actual (wanted $desired)"
    conflict_count=$((conflict_count + 1))
    return 0
  fi

  if [ -e "$target" ]; then
    print_status conflict "$label exists and is not a symlink"
    conflict_count=$((conflict_count + 1))
    return 0
  fi

  if [ "$MODE" = "check" ]; then
    print_status missing "$label (wanted $desired)"
    missing_count=$((missing_count + 1))
    return 0
  fi

  if [ "$DRY_RUN" = "1" ]; then
    print_status would-link "$label -> $desired"
    return 0
  fi

  local parent
  parent=$(dirname "$target")
  mkdir -p "$parent"
  if ln -s "$desired" "$target"; then
    print_status linked "$label -> $desired"
    linked_count=$((linked_count + 1))
  else
    print_status conflict "failed to create $label"
    conflict_count=$((conflict_count + 1))
  fi
}

sync_project() {
  local root="$1"
  print_section "project: $root"

  local agents_skills="$root/.agents/skills"
  local agents_prompts="$root/.agents/prompts"

  if [ -d "$agents_skills" ]; then
    print_status native ".agents/skills (command-code, pi, opencode, cursor)"
    if [ -e "$root/.commandcode/skills" ]; then
      print_status warn ".commandcode/skills exists; it shadows .agents/skills"
    fi
    if tool_enabled claude; then
      check_link "$root/.claude/skills" "../.agents/skills" ".claude/skills"
    fi
  else
    print_status skip ".agents/skills not found"
    skipped_count=$((skipped_count + 1))
  fi

  if [ -d "$agents_prompts" ]; then
    if tool_enabled claude; then
      check_link "$root/.claude/commands" "../.agents/prompts" ".claude/commands"
    fi
    if tool_enabled command-code; then
      check_link "$root/.commandcode/commands" "../.agents/prompts" ".commandcode/commands"
    fi
    if tool_enabled pi; then
      check_link "$root/.pi/prompts" "../.agents/prompts" ".pi/prompts"
    fi
    if tool_enabled opencode; then
      check_link "$root/.opencode/commands" "../.agents/prompts" ".opencode/commands"
    fi
    if tool_enabled cursor; then
      check_link "$root/.cursor/commands" "../.agents/prompts" ".cursor/commands"
    fi
  else
    print_status skip ".agents/prompts not found"
    skipped_count=$((skipped_count + 1))
  fi

  if [ -f "$root/AGENTS.md" ]; then
    print_status native "AGENTS.md (project memory)"
  elif [ -f "$root/CLAUDE.md" ]; then
    print_status info "CLAUDE.md only (prefer AGENTS.md for AGENTS.md-native tools)"
  else
    print_status warn "no AGENTS.md or CLAUDE.md"
  fi

  if [ -e "$root/.pi/agent/prompts" ]; then
    print_status warn ".pi/agent/prompts exists; Pi 1.4.0 reads .pi/prompts, not .pi/agent/prompts"
  fi
}

sync_project "$ROOT"

print_section "summary"
printf 'ok=%d linked=%d missing=%d conflicts=%d skipped=%d\n' \
  "$ok_count" "$linked_count" "$missing_count" "$conflict_count" "$skipped_count"

if [ "$MODE" = "check" ] && { [ "$missing_count" -gt 0 ] || [ "$conflict_count" -gt 0 ]; }; then
  exit 1
fi

if [ "$conflict_count" -gt 0 ]; then
  exit 2
fi

exit 0
