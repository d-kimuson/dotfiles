#!/bin/bash
set -uo pipefail

input=$(cat)

# ANSI colors (aligned with ~/.claude/statusline.sh)
GREEN=$'\033[92m'
YELLOW=$'\033[33m'
RED=$'\033[91m'
RESET=$'\033[0m'

# --- Gather base fields in a single jq pass ---
dir=""
agy_version=""
pct="0"
model="unknown"
effort=""
vcs_branch=""

if [ -n "$input" ]; then
  base_tsv=$(printf '%s' "$input" | jq -r '
    def non_empty:
      if type == "string" then
        gsub("[\t\r\n]"; " ") | if length > 0 then . else null end
      else
        null
      end;

    if type == "object" then
      ((.model.effort | non_empty) // "") as $effort |
      ((.model.display_name | non_empty) // (.model.id | non_empty) // "unknown") as $raw_model |
      (if ($effort | test("^[A-Za-z0-9_-]+$")) then
        ($raw_model | sub(" \\(" + $effort + "\\)$"; ""; "i"))
      else
        $raw_model
      end) as $model |
      ((.context_window.used_percentage // 0) | if type == "number" then floor else 0 end | if . < 0 then 0 elif . > 100 then 100 else . end) as $pct |
      [
        ((.workspace.current_dir | non_empty) // (.cwd | non_empty) // "-"),
        ((.version | non_empty) // "-"),
        ($pct | tostring),
        (($model | non_empty) // "unknown"),
        (if ($effort | length) > 0 then $effort else "-" end),
        ((.vcs.branch | non_empty) // "-")
      ] | join("\t")
    else
      empty
    end
  ' 2>/dev/null || true)

  if [ -n "$base_tsv" ]; then
    IFS=$'\t' read -r dir agy_version pct model effort vcs_branch <<< "$base_tsv"
    [ "$dir" = "-" ] && dir=""
    [ "$agy_version" = "-" ] && agy_version=""
    [ "$effort" = "-" ] && effort=""
    [ "$vcs_branch" = "-" ] && vcs_branch=""
  fi
fi

raw_dir="${dir:-$HOME}"
case "$raw_dir" in
  "$HOME") display_dir="~" ;;
  "$HOME"/*) display_dir="~${raw_dir#"$HOME"}" ;;
  *) display_dir="$raw_dir" ;;
esac

branch=""
repo=""
if [ -n "$dir" ] && [ -d "$dir" ]; then
  branch=$(git -C "$dir" branch --show-current 2>/dev/null || true)
  toplevel=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null || true)
  [ -n "$toplevel" ] && repo=$(basename "$toplevel")
fi
[ -z "$branch" ] && [ -n "$vcs_branch" ] && branch="$vcs_branch"

# --- Progress bar ---
make_bar() {
  local val="${1:-0}" len=10
  local filled=$(( val * len / 100 ))
  [ "$filled" -lt 0 ] && filled=0
  [ "$filled" -gt "$len" ] && filled=$len
  local empty=$(( len - filled ))
  local bar="" i
  for ((i=0; i<filled; i++)); do bar+="█"; done
  for ((i=0; i<empty; i++)); do bar+="░"; done
  printf '%s' "$bar"
}
ctx_bar=$(make_bar "$pct")

# --- Time & pace helpers (aligned with ~/.claude/statusline.sh) ---
format_epoch() {
  local epoch="$1" fmt="$2"
  { date -d "@$epoch" "$fmt" 2>/dev/null || date -r "$epoch" "$fmt" 2>/dev/null; } | sed 's/  */ /g'
}

parse_iso_utc_epoch() {
  local iso="$1"
  [ -z "$iso" ] && return 1
  local epoch="" normalized="$iso"
  if [[ "$normalized" == *.*Z ]]; then
    normalized="${normalized%%.*}Z"
  fi
  # Try BSD date (-j) first; GNU date rejects -j cleanly, whereas BSD date treats -d as setting DST
  epoch=$(date -j -u -f "%Y-%m-%dT%H:%M:%SZ" "$normalized" +%s 2>/dev/null || true)
  if [ -n "$epoch" ]; then
    printf '%s' "$epoch"
    return 0
  fi
  epoch=$(date -u -d "$iso" +%s 2>/dev/null || true)
  if [ -n "$epoch" ]; then
    printf '%s' "$epoch"
    return 0
  fi
  return 1
}

pace_color() {
  local usage_pct="${1:-0}" elapsed_pct="${2:-}"
  if [ "$usage_pct" -le 0 ]; then
    printf '%s' "$GREEN"
    return
  fi
  if [ -n "$elapsed_pct" ]; then
    local diff=$(( usage_pct - elapsed_pct ))
    if [ "$diff" -ge 10 ]; then
      printf '%s' "$RED"
    elif [ "$diff" -ge 0 ]; then
      printf '%s' "$YELLOW"
    else
      printf '%s' "$GREEN"
    fi
  else
    if [ "$usage_pct" -ge 90 ]; then
      printf '%s' "$RED"
    elif [ "$usage_pct" -ge 70 ]; then
      printf '%s' "$YELLOW"
    else
      printf '%s' "$GREEN"
    fi
  fi
}

# --- Output lines 1-3 ---
if [ -n "$agy_version" ]; then
  echo "agy@${agy_version} at ${display_dir}"
else
  echo "agy at ${display_dir}"
fi

if [ -n "$branch" ] && [ -n "$repo" ]; then
  echo "⎇ ${branch} | 🐙 ${repo}"
elif [ -n "$branch" ]; then
  echo "⎇ ${branch}"
fi

if [ -n "$effort" ]; then
  echo "🧠 ${ctx_bar} ${pct}% | ${model} | ${effort}"
else
  echo "🧠 ${ctx_bar} ${pct}% | ${model}"
fi

# --- Quota line (from .quota buckets) ---
quota_rows=""
if [ -n "$input" ]; then
  quota_rows=$(printf '%s' "$input" | jq -r '
    def non_empty:
      if type == "string" then
        gsub("[\t\r\n]"; " ") | if length > 0 then . else null end
      else
        null
      end;

    def classify_bucket:
      ascii_downcase as $low |
      (if ($low | startswith("gemini-")) then
        { group_rank: 1, group: "gemini", rest: (sub("^gemini-"; ""; "i")) }
      elif ($low | startswith("3p-")) then
        { group_rank: 2, group: "3p", rest: (sub("^3p-"; ""; "i")) }
      else
        { group_rank: 3, group: "_other", rest: . }
      end) as $grp |
      ($grp.rest | ascii_downcase) as $rlow |
      (if ($rlow | test("^(5h|5hour|five-hour)$")) then
        { rank: 1, window: 18000, long: 0, label: "5h" }
      elif ($rlow | test("-(5h|5hour|five-hour)$")) then
        { rank: 1, window: 18000, long: 0, label: ($grp.rest | sub("-(5h|5hour|five-hour)$"; " 5h"; "i")) }
      elif ($rlow | test("^(daily|1d|24h)$")) then
        { rank: 2, window: 86400, long: 0, label: "1d" }
      elif ($rlow | test("-(daily|1d|24h)$")) then
        { rank: 2, window: 86400, long: 0, label: ($grp.rest | sub("-(daily|1d|24h)$"; " 1d"; "i")) }
      elif ($rlow | test("^(weekly|7d)$")) then
        { rank: 3, window: 604800, long: 1, label: "7d" }
      elif ($rlow | test("-(weekly|7d)$")) then
        { rank: 3, window: 604800, long: 1, label: ($grp.rest | sub("-(weekly|7d)$"; " 7d"; "i")) }
      elif ($rlow | test("^(monthly|30d)$")) then
        { rank: 4, window: 2592000, long: 1, label: "30d" }
      elif ($rlow | test("-(monthly|30d)$")) then
        { rank: 4, window: 2592000, long: 1, label: ($grp.rest | sub("-(monthly|30d)$"; " 30d"; "i")) }
      else
        { rank: 5, window: 0, long: -1, label: $grp.rest }
      end) as $win |
      {
        group_rank: $grp.group_rank,
        group: $grp.group,
        rank: $win.rank,
        window: $win.window,
        long: $win.long,
        label: $win.label
      };

    if type == "object" and (.quota | type == "object") then
      [
        .quota | to_entries[] |
        select((.key | non_empty) != null) |
        select(.value | type == "object" and (.disabled // false | not)) |
        ((.key | non_empty) | classify_bucket) as $meta |
        if (.value.remaining_fraction | type == "number") then
          {
            group_rank: $meta.group_rank,
            group: $meta.group,
            rank: $meta.rank,
            key: (.key | non_empty),
            label: (($meta.label | non_empty) // "-"),
            kind: "fraction",
            val: (((1 - .value.remaining_fraction) * 100) | round | if . < 0 then 0 elif . > 100 then 100 else . end | tostring),
            window: $meta.window,
            long: $meta.long,
            reset_in: (if (.value.reset_in_seconds | type == "number") then (.value.reset_in_seconds | floor | tostring) else "-" end),
            reset_time: ((.value.reset_time | non_empty) // "-")
          }
        elif (.value.remaining_amount | type == "number") then
          {
            group_rank: $meta.group_rank,
            group: $meta.group,
            rank: $meta.rank,
            key: (.key | non_empty),
            label: (($meta.label | non_empty) // "-"),
            kind: "amount",
            val: (.value.remaining_amount | tostring),
            window: $meta.window,
            long: $meta.long,
            reset_in: (if (.value.reset_in_seconds | type == "number") then (.value.reset_in_seconds | floor | tostring) else "-" end),
            reset_time: ((.value.reset_time | non_empty) // "-")
          }
        else
          empty
        end
      ]
      | sort_by(.group_rank, .group, .rank, .key)
      | .[]
      | [.group, .label, .kind, .val, (.window | tostring), (.long | tostring), .reset_in, .reset_time]
      | join("\t")
    else
      empty
    end
  ' 2>/dev/null || true)
fi

if [ -n "$quota_rows" ]; then
  now_epoch=$(date +%s)
  current_group=""
  usage_line=""
  first=1

  while IFS=$'\t' read -r q_group q_label q_kind q_val q_window q_long q_reset_in q_reset_time; do
    [ -z "$q_label" ] && continue

    if [ "$q_group" != "$current_group" ]; then
      if [ -n "$usage_line" ]; then
        echo "$usage_line"
      fi
      current_group="$q_group"
      if [ "$q_group" = "_other" ]; then
        usage_line="💰"
      else
        usage_line="💰 ${q_group}:"
      fi
      first=1
    fi

    reset_epoch=""
    remaining_secs=""
    if [ "$q_reset_in" != "-" ] && [ "$q_reset_in" -ge 0 ] 2>/dev/null; then
      remaining_secs="$q_reset_in"
      reset_epoch=$(( now_epoch + remaining_secs ))
    elif [ "$q_reset_time" != "-" ]; then
      reset_epoch=$(parse_iso_utc_epoch "$q_reset_time" || true)
      if [ -n "$reset_epoch" ]; then
        remaining_secs=$(( reset_epoch - now_epoch ))
      fi
    fi

    reset_str=""
    if [ -n "$reset_epoch" ]; then
      use_long="$q_long"
      if [ "$use_long" = "-1" ]; then
        if [ -n "$remaining_secs" ] && [ "$remaining_secs" -gt 86400 ]; then
          use_long="1"
        else
          use_long="0"
        fi
      fi
      if [ "$use_long" = "1" ]; then
        reset_str=$(format_epoch "$reset_epoch" '+%-m/%-d %p%-l時')
      else
        reset_str=$(format_epoch "$reset_epoch" '+%p%-l時')
      fi
    fi

    elapsed_pct=""
    if [ "$q_window" -gt 0 ] 2>/dev/null && [ -n "$remaining_secs" ]; then
      elapsed=$(( q_window - remaining_secs ))
      [ "$elapsed" -lt 0 ] && elapsed=0
      [ "$elapsed" -gt "$q_window" ] && elapsed=$q_window
      elapsed_pct=$(( elapsed * 100 / q_window ))
    fi

    [ "$first" -eq 0 ] && usage_line+=" |"
    first=0

    if [ "$q_kind" = "fraction" ]; then
      q_color=$(pace_color "$q_val" "$elapsed_pct")
      usage_line+=" ${q_label} ${q_color}${q_val}%${RESET}"
      q_meta=""
      [ -n "$reset_str" ] && q_meta+="🔄 ${reset_str}"
      [ -n "$elapsed_pct" ] && q_meta+="${q_meta:+, }${elapsed_pct}%"
      [ -n "$q_meta" ] && usage_line+=" (${q_meta})"
    else
      usage_line+=" ${q_label} rem ${q_val}"
      [ -n "$reset_str" ] && usage_line+=" (🔄 ${reset_str})"
    fi
  done <<< "$quota_rows"

  if [ -n "$usage_line" ]; then
    echo "$usage_line"
  fi
fi
