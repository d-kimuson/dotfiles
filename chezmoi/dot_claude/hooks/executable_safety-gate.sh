#!/usr/bin/env bash
# Safety Gate - PreToolUse hook
# Block access to secret/credential files.
# .env is intentionally NOT blocked (used for non-secret env switching).
set -euo pipefail

input="$(cat)"
tool_name="$(jq -r '.tool_name // empty' <<< "$input")"

case "$tool_name" in
  Read|Write|Edit|NotebookEdit)
    target="$(jq -r '.tool_input.file_path // empty' <<< "$input")"
    ;;
  Grep)
    target="$(jq -r '.tool_input.path // empty' <<< "$input")"
    ;;
  Bash)
    target="$(jq -r '.tool_input.command // empty' <<< "$input")"
    ;;
  *)
    exit 0
    ;;
esac

[ -z "$target" ] && exit 0

BLOCKED_PATTERNS=(
  '\.secrets'
  'credentials\.json'
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$target" | grep -qE "$pattern"; then
    echo "BLOCKED: Access to file matching pattern '$pattern' is not allowed." >&2
    exit 2
  fi
done

exit 0
