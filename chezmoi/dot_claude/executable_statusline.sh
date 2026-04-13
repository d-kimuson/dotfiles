#!/bin/bash
input=$(cat)

SETTINGS_FILE="$HOME/.claude/settings.json"
DEFAULT_MODEL="opus"
FALLBACK_MODEL="sonnet"

# ANSI colors
GREEN=$'\033[92m'
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

claude_version=$(claude --version 2>/dev/null | head -1 | awk '{print $1}')

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

# --- Rate limits (from statusline input) ---
format_reset_time_short() {
  local epoch="$1"
  [ -z "$epoch" ] || [ "$epoch" = "null" ] && return
  date -d "@$epoch" '+%p%-l時' 2>/dev/null | sed 's/  */ /g'
}

format_reset_time_long() {
  local epoch="$1"
  [ -z "$epoch" ] || [ "$epoch" = "null" ] && return
  date -d "@$epoch" '+%-m/%-d %p%-l時' 2>/dev/null | sed 's/  */ /g'
}

# Calculate elapsed % for a window given reset time (epoch) and window duration in seconds
calc_elapsed_pct() {
  local reset_epoch="$1" window_secs="$2"
  [ -z "$reset_epoch" ] || [ "$reset_epoch" = "null" ] && return
  local now_epoch remaining elapsed
  now_epoch=$(date +%s)
  remaining=$(( reset_epoch - now_epoch ))
  elapsed=$(( window_secs - remaining ))
  [ "$elapsed" -lt 0 ] && elapsed=0
  [ "$elapsed" -gt "$window_secs" ] && elapsed=$window_secs
  echo $(( elapsed * 100 / window_secs ))
}

# Color based on pace: usage% vs elapsed%
# usage < elapsed → green, 0 <= (usage-elapsed) < 10 → yellow, >= 10 → red
pace_color() {
  local usage_pct="${1:-0}" elapsed_pct="${2:-0}"
  local diff=$(( usage_pct - elapsed_pct ))
  if [ "$diff" -ge 10 ]; then
    printf '%s' "$RED"
  elif [ "$diff" -ge 0 ]; then
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

five_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty' 2>/dev/null | cut -d. -f1)
five_reset_epoch=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty' 2>/dev/null)
if [ -n "$five_reset_epoch" ] && [ "$five_reset_epoch" != "null" ]; then
  five_reset=$(format_reset_time_short "$five_reset_epoch")
  five_elapsed_pct=$(calc_elapsed_pct "$five_reset_epoch" 18000)
fi

seven_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty' 2>/dev/null | cut -d. -f1)
seven_reset_epoch=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty' 2>/dev/null)
if [ -n "$seven_reset_epoch" ] && [ "$seven_reset_epoch" != "null" ]; then
  seven_reset=$(format_reset_time_long "$seven_reset_epoch")
  seven_elapsed_pct=$(calc_elapsed_pct "$seven_reset_epoch" 604800)
fi

# --- Auto model switch based on pace ---
current_model=$(jq -r '.model // empty' "$SETTINGS_FILE" 2>/dev/null)
switched=""
five_over=0
seven_over=0
[ -n "$five_pct" ] && [ -n "$five_elapsed_pct" ] && [ "$five_pct" -gt "$five_elapsed_pct" ] 2>/dev/null && five_over=1
[ -n "$seven_pct" ] && [ -n "$seven_elapsed_pct" ] && [ "$seven_pct" -gt "$seven_elapsed_pct" ] 2>/dev/null && seven_over=1

if [ "$five_over" -eq 1 ] || [ "$seven_over" -eq 1 ]; then
  # Pace exceeded → switch to fallback
  if [ "$current_model" = "$DEFAULT_MODEL" ]; then
    jq --arg m "$FALLBACK_MODEL" '.model = $m' "$SETTINGS_FILE" > "${SETTINGS_FILE}.tmp" \
      && mv "${SETTINGS_FILE}.tmp" "$SETTINGS_FILE"
    switched=" ⚡"
  fi
elif [ "$five_over" -eq 0 ] && [ "$seven_over" -eq 0 ]; then
  # Both within pace → restore default
  if [ "$current_model" = "$FALLBACK_MODEL" ]; then
    jq --arg m "$DEFAULT_MODEL" '.model = $m' "$SETTINGS_FILE" > "${SETTINGS_FILE}.tmp" \
      && mv "${SETTINGS_FILE}.tmp" "$SETTINGS_FILE"
    switched=" ✨"
  fi
fi

# --- Output ---
version_prefix=""
[ -n "$claude_version" ] && version_prefix="claude-code@${claude_version} at "
echo "${version_prefix}${display_dir}"

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
    five_meta=""
    [ -n "$five_reset" ] && five_meta+="🔄 ${five_reset}"
    [ -n "$five_elapsed_pct" ] && five_meta+="${five_meta:+, }${five_elapsed_pct}%"
    [ -n "$five_meta" ] && usage_line+=" (${five_meta})"
  fi
  if [ -n "$seven_pct" ]; then
    [ -n "$five_pct" ] && usage_line+=" |"
    seven_color=$(pace_color "$seven_pct" "$seven_elapsed_pct")
    usage_line+=" 7d ${seven_color}${seven_pct}%${RESET}"
    seven_meta=""
    [ -n "$seven_reset" ] && seven_meta+="🔄 ${seven_reset}"
    [ -n "$seven_elapsed_pct" ] && seven_meta+="${seven_meta:+, }${seven_elapsed_pct}%"
    [ -n "$seven_meta" ] && usage_line+=" (${seven_meta})"
  fi
  echo "$usage_line"
fi
