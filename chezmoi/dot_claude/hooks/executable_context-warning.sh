#!/usr/bin/env bash
# PreCompact (auto) hook - warn user to run /handoff before auto-compact
# Blocks the FIRST auto-compact per session; subsequent ones proceed normally.
set -euo pipefail

input="$(cat)"
sid="$(jq -r '.session_id // "unknown"' <<< "$input")"
state_file="/tmp/claude-compact-warned-${sid}"

if [ -f "$state_file" ]; then
  exit 0
fi

touch "$state_file"

cat <<'JSON'
{
  "systemMessage": "コンテキスト枠の残量が小さくなっています。/handoff を使って autocompact 前に情報を残してください。",
  "continue": false,
  "stopReason": "コンテキスト枠の残量が小さくなっています。/handoff を使って autocompact 前に情報を残してください。"
}
JSON
