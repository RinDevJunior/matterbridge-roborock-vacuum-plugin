#!/usr/bin/env bash
# Cursor CLI status line — matches Claude terminal style
# Place in .cursor/statusline.sh and configure cli-config.json to point here.
input=$(cat)

model=$(echo "$input" | jq -r '.model.display_name // "Claude"')
param=$(echo "$input" | jq -r '.model.param_summary // empty')
max_mode=$(echo "$input" | jq -r '.model.max_mode // false')
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

render_bar() {
  local pct=$1 bar_len=$2 label=$3 color=$4
  local filled=$(( (pct * bar_len + 50) / 100 ))
  local empty=$(( bar_len - filled ))
  local bar=""
  [ "$filled" -gt 0 ] && for i in $(seq 1 $filled); do bar="${bar}${color}█\033[0m"; done
  [ "$empty"  -gt 0 ] && for i in $(seq 1 $empty);  do bar="${bar}\033[90m█\033[0m"; done
  printf " \033[90m|\033[0m ${color}%s:%d%%\033[0m %b" "$label" "$pct" "$bar"
}

# Model name
printf "\033[36m%s\033[0m" "$model"

# Param summary (effort/thinking)
if [ -n "$param" ]; then
  case "$(echo "$param" | tr '[:upper:]' '[:lower:]')" in
    *low*) color="\033[33m" ;;
    *medium*) color="\033[36m" ;;
    *high*|*max*|*thinking*) color="\033[31m" ;;
    *) color="\033[35m" ;;
  esac
  printf " ${color}~%s\033[0m" "$param"
fi

[ "$max_mode" = "true" ] && printf " \033[31m~MAX\033[0m"

# Context bar (20 chars) — green under 70%, red 70%+
if [ -n "$used" ]; then
  used_int=$(printf "%.0f" "$used")
  [ "$used_int" -ge 70 ] && color="\033[31m" || color="\033[32m"
  render_bar "$used_int" 20 "context" "$color"
fi

# Git branch
branch=""
if [ -n "$cwd" ] && [ -d "$cwd" ]; then
  branch=$(cd "$cwd" && git branch --show-current 2>/dev/null || true)
fi

# Current directory + branch
if [ -n "$cwd" ]; then
  dir_display="$cwd"
  [ -n "$branch" ] && dir_display="$cwd ($branch)"
  printf " \033[90m|\033[0m \033[35m%s\033[0m" "$dir_display"
fi
