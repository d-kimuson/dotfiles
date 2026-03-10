#!/bin/bash
input=$(cat)

SETTINGS_FILE="$HOME/.claude/settings.json"
USAGE_CACHE="/tmp/claude-statusline-usage.json"
USAGE_CACHE_AGE=60

DEFAULT_MODEL="opus"
FALLBACK_MODEL="sonnet"

# ANSI colors
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
RED=$'\033[91m'
RESET=$'\033[0m'

# --- Gather data ---
dir=$(echo "$input" | jq -r '.workspace.current_dir // empty')
display_dir=$(echo "${dir:-$HOME}" | sed "s|$HOME|~|")

branch=""
repo=""
if [ -n "$dir" ] && [ -d "$dir" ]; then
  branch=$(cd "$dir" && git branch --show-current 2>/dev/null)
  repo=$(cd "$dir" && basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null)
fi

pct=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
model=$(echo "$input" | jq -r '.model.display_name // .model.id // "unknown"')

# --- Reasoning effort ---
effort=$(jq -r '.effortLevel // empty' "$SETTINGS_FILE" 2>/dev/null)
[ -z "$effort" ] && effort="medium"

# --- Progress bar ---
make_bar() {
  local val=${1:-0} len=10
  local filled=$(( val * len / 100 ))
  [ "$filled" -gt "$len" ] && filled=$len
  local empty=$(( len - filled ))
  local bar=""
  for ((i=0; i<filled; i++)); do bar+="█"; done
  for ((i=0; i<empty; i++)); do bar+="░"; done
  echo "$bar"
}
ctx_bar=$(make_bar "$pct")

# --- Usage API (cached) ---
get_token() {
  if [[ "$OSTYPE" == darwin* ]]; then
    security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null \
      | jq -r '.claudeAiOauth.accessToken // empty' 2>/dev/null
  else
    jq -r '.claudeAiOauth.accessToken // empty' "$HOME/.claude/.credentials.json" 2>/dev/null
  fi
}

USAGE_LOCK_FILE="/tmp/claude-statusline-usage.lock"
USAGE_BACKOFF=300  # 5 min backoff on failure

fetch_usage() {
  local token
  token=$(get_token)
  [ -z "$token" ] || [ "$token" = "null" ] && return 1
  local response
  response=$(curl -sf --max-time 3 \
    -H "Authorization: Bearer $token" \
    -H "anthropic-beta: oauth-2025-04-20" \
    -H "Content-Type: application/json" \
    "https://api.anthropic.com/api/oauth/usage" 2>/dev/null)
  if echo "$response" | jq -e '.five_hour' >/dev/null 2>&1; then
    echo "$response" > "$USAGE_CACHE"
    rm -f "$USAGE_LOCK_FILE"
    return 0
  else
    # Record failure time for backoff
    date +%s > "$USAGE_LOCK_FILE"
    return 1
  fi
}

needs_refresh=1
if [ -s "$USAGE_CACHE" ]; then
  cache_mtime=$(stat -f%m "$USAGE_CACHE" 2>/dev/null || stat -c%Y "$USAGE_CACHE" 2>/dev/null || echo 0)
  cache_age=$(( $(date +%s) - cache_mtime ))
  [ "$cache_age" -lt "$USAGE_CACHE_AGE" ] && needs_refresh=0
fi
# Respect backoff on previous failure
if [ "$needs_refresh" -eq 1 ] && [ -f "$USAGE_LOCK_FILE" ]; then
  lock_time=$(cat "$USAGE_LOCK_FILE" 2>/dev/null || echo 0)
  lock_age=$(( $(date +%s) - lock_time ))
  [ "$lock_age" -lt "$USAGE_BACKOFF" ] && needs_refresh=0
fi
[ "$needs_refresh" -eq 1 ] && fetch_usage 2>/dev/null

# Parse usage data
format_reset_time_short() {
  local iso="$1"
  [ -z "$iso" ] || [ "$iso" = "null" ] && return
  date -d "$iso" '+%-l%p' 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr -d ' '
}

format_reset_time_long() {
  local iso="$1"
  [ -z "$iso" ] || [ "$iso" = "null" ] && return
  date -d "$iso" '+%-m/%-d %-l%p' 2>/dev/null | tr '[:upper:]' '[:lower:]' | sed 's/  */ /g'
}

# Calculate elapsed % for a window given reset time and window duration in seconds
calc_elapsed_pct() {
  local reset_raw="$1" window_secs="$2"
  local reset_epoch now_epoch remaining elapsed
  reset_epoch=$(date -d "$reset_raw" +%s 2>/dev/null) || return
  now_epoch=$(date +%s)
  remaining=$(( reset_epoch - now_epoch ))
  elapsed=$(( window_secs - remaining ))
  [ "$elapsed" -lt 0 ] && elapsed=0
  [ "$elapsed" -gt "$window_secs" ] && elapsed=$window_secs
  echo $(( elapsed * 100 / window_secs ))
}

# Color based on pace: usage% vs elapsed%
# margin > +10 → red (over pace), +-10 → yellow, < -10 → green
pace_color() {
  local usage_pct="${1:-0}" elapsed_pct="${2:-0}"
  local diff=$(( usage_pct - elapsed_pct ))
  if [ "$diff" -gt 10 ]; then
    printf '%s' "$RED"
  elif [ "$diff" -ge -10 ]; then
    printf '%s' "$YELLOW"
  else
    printf '%s' "$GREEN"
  fi
}

five_pct=""
five_reset=""
five_elapsed_pct=""
seven_pct=""
seven_reset=""
seven_elapsed_pct=""
if [ -s "$USAGE_CACHE" ]; then
  five_pct=$(jq -r '.five_hour.utilization // empty' "$USAGE_CACHE" 2>/dev/null | cut -d. -f1)
  five_reset_raw=$(jq -r '.five_hour.resets_at // empty' "$USAGE_CACHE" 2>/dev/null)
  five_reset=$(format_reset_time_short "$five_reset_raw")
  [ -n "$five_reset_raw" ] && [ "$five_reset_raw" != "null" ] && five_elapsed_pct=$(calc_elapsed_pct "$five_reset_raw" 18000)

  seven_pct=$(jq -r '.seven_day.utilization // empty' "$USAGE_CACHE" 2>/dev/null | cut -d. -f1)
  seven_reset_raw=$(jq -r '.seven_day.resets_at // empty' "$USAGE_CACHE" 2>/dev/null)
  seven_reset=$(format_reset_time_long "$seven_reset_raw")
  [ -n "$seven_reset_raw" ] && [ "$seven_reset_raw" != "null" ] && seven_elapsed_pct=$(calc_elapsed_pct "$seven_reset_raw" 604800)
fi

# --- Auto model switch based on pace ---
current_model=$(jq -r '.model // empty' "$SETTINGS_FILE" 2>/dev/null)
switched=""
if [ -n "$five_pct" ] && [ -n "$five_elapsed_pct" ]; then
  if [ "$five_pct" -gt "$five_elapsed_pct" ] 2>/dev/null; then
    if [ "$current_model" = "$DEFAULT_MODEL" ]; then
      jq --arg m "$FALLBACK_MODEL" '.model = $m' "$SETTINGS_FILE" > "${SETTINGS_FILE}.tmp" \
        && mv "${SETTINGS_FILE}.tmp" "$SETTINGS_FILE"
      switched=" ⚡"
    fi
  fi
fi

# --- Output ---
echo "📂 ${display_dir}"

if [ -n "$branch" ] && [ -n "$repo" ]; then
  echo "⎇ ${branch} | 🐙 ${repo}"
elif [ -n "$branch" ]; then
  echo "⎇ ${branch}"
fi

echo "🧠 ${ctx_bar} ${pct}%${switched} | ${model} | ${effort}"

if [ -n "$five_pct" ] || [ -n "$seven_pct" ]; then
  usage_line="💰"
  if [ -n "$five_pct" ]; then
    five_color=$(pace_color "$five_pct" "$five_elapsed_pct")
    usage_line+=" 5h ${five_color}${five_pct}%${RESET}"
    [ -n "$five_reset" ] && usage_line+=" (🔄 ${five_reset})"
  fi
  if [ -n "$seven_pct" ]; then
    [ -n "$five_pct" ] && usage_line+=" |"
    seven_color=$(pace_color "$seven_pct" "$seven_elapsed_pct")
    usage_line+=" 7d ${seven_color}${seven_pct}%${RESET}"
    [ -n "$seven_reset" ] && usage_line+=" (🔄 ${seven_reset})"
  fi
  echo "$usage_line"
fi
