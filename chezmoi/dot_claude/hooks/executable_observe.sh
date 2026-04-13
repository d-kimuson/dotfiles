#!/usr/bin/env bash
# Observability hook - log agent events to JSONL
# PreToolUse: agent intent, PostToolUse: result, PreCompact: lost context
set -euo pipefail

LOG_DIR="${HOME}/.claude/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/events-$(date +%Y-%m-%d).jsonl"

input="$(cat)"
event="$(jq -r '.hook_event_name // "unknown"' <<< "$input")"
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
sid="$(jq -r '.session_id // "unknown"' <<< "$input")"

case "$event" in
  PreToolUse)
    jq -nc \
      --arg ts "$ts" --arg ev "$event" --arg sid "$sid" \
      --arg tool "$(jq -r '.tool_name // empty' <<< "$input")" \
      --argjson summary "$(jq -c '{
        file_path: .tool_input.file_path,
        path: .tool_input.path,
        command: .tool_input.command,
        pattern: .tool_input.pattern,
        query: .tool_input.query,
        description: .tool_input.description
      } | with_entries(select(.value != null))' <<< "$input")" \
      '{ts:$ts, event:$ev, session:$sid, tool:$tool, summary:$summary}' \
      >> "$LOG_FILE"
    ;;
  PostToolUse)
    jq -nc \
      --arg ts "$ts" --arg ev "$event" --arg sid "$sid" \
      --arg tool "$(jq -r '.tool_name // empty' <<< "$input")" \
      --arg preview "$(jq -r '(.tool_response // "") | tostring | .[0:200]' <<< "$input")" \
      '{ts:$ts, event:$ev, session:$sid, tool:$tool, response_preview:$preview}' \
      >> "$LOG_FILE"
    ;;
  PreCompact)
    jq -nc \
      --arg ts "$ts" --arg ev "$event" --arg sid "$sid" \
      --arg transcript "$(jq -r '.transcript_path // empty' <<< "$input")" \
      '{ts:$ts, event:$ev, session:$sid, transcript:$transcript}' \
      >> "$LOG_FILE"
    ;;
esac

exit 0
