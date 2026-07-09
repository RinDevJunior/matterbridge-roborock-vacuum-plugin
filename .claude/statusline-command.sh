#!/usr/bin/env bash
input=$(cat)

model=$(echo "$input" | jq -r '.model.display_name // "Claude"')
cwd=$(echo "$input" | jq -r '.cwd // empty')
effort=$(echo "$input" | jq -r '.effort.level // empty')
thinking=$(echo "$input" | jq -r '.thinking.enabled // false')
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
five_hour_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
five_hour_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
seven_day_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
seven_day_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

render_bar() {
  local pct=$1 bar_len=$2 label=$3 color=$4
  local filled=$(( (pct * bar_len + 50) / 100 ))
  local empty=$(( bar_len - filled ))
  local bar=""
  [ "$filled" -gt 0 ] && for i in $(seq 1 $filled); do bar="${bar}${color}█\033[0m"; done
  [ "$empty"  -gt 0 ] && for i in $(seq 1 $empty);  do bar="${bar}\033[90m█\033[0m"; done
  if [ -n "$label" ]; then
    printf "${color}%s:%d%%\033[0m %b" "$label" "$pct" "$bar"
  else
    printf "${color}%-6s\033[0m %b" "${pct}%" "$bar"
  fi
}

# Row 1: Model + effort indicator + context bar
printf "\033[1m%-9s\033[0m " "Overall:"
printf "\033[36m%s\033[0m" "$model"
if [ -n "$effort" ]; then
  case "$effort" in
    low) color="\033[33m" ;;
    medium) color="\033[36m" ;;
    high|xhigh|max) color="\033[31m" ;;
    *) color="\033[35m" ;;
  esac
  printf " ${color}~%s\033[0m" "$effort"
fi

printf "\n"

# Row 2: context bar
printf "\033[1m%-9s\033[0m " "Context:"
if [ -n "$used" ]; then
  used_int=$(printf "%.0f" "$used")
  [ "$used_int" -ge 70 ] && color="\033[31m" || color="\033[32m"
  render_bar "$used_int" 20 "" "$color"
fi

printf "\n"

# Row 3: 5h/7d usage rate limit bars
printf "\033[1m%-9s\033[0m " "Usage:"
# 5h bar (20 chars) — green <50%, yellow 50-74%, red 75%+
if [ -n "$five_hour_pct" ]; then
  pct_int=$(printf "%.0f" "$five_hour_pct")
  if [ "$pct_int" -ge 75 ]; then color="\033[31m"
  elif [ "$pct_int" -ge 50 ]; then color="\033[33m"
  else color="\033[32m"; fi
  render_bar "$pct_int" 20 "5h" "$color"
  if [ -n "$five_hour_reset" ]; then
    reset_time=$(date -r "$five_hour_reset" +"%-I:%M%p" 2>/dev/null | tr '[:upper:]' '[:lower:]')
    [ -n "$reset_time" ] && printf " \033[90mreset: %s\033[0m" "$reset_time"
  fi
fi

# 7d bar (20 chars) — green <50%, yellow 50-74%, red 75%+
if [ -n "$seven_day_pct" ]; then
  pct_int=$(printf "%.0f" "$seven_day_pct")
  if [ "$pct_int" -ge 75 ]; then color="\033[31m"
  elif [ "$pct_int" -ge 50 ]; then color="\033[33m"
  else color="\033[32m"; fi
  [ -n "$five_hour_pct" ] && printf " \033[90m|\033[0m "
  render_bar "$pct_int" 20 "7d" "$color"
  if [ -n "$seven_day_reset" ]; then
    reset_time=$(date -r "$seven_day_reset" +"%d/%m/%Y %-I:%M%p" 2>/dev/null | tr '[:upper:]' '[:lower:]')
    [ -n "$reset_time" ] && printf " \033[90mreset: %s\033[0m" "$reset_time"
  fi
fi

printf "\n"

# Row 4: Current Claude activated directory
printf "\033[1m%-9s\033[0m " "CWD:"
if [ -n "$cwd" ]; then
  printf "\033[35m%s\033[0m" "$cwd"
fi
