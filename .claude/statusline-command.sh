#!/usr/bin/env bash
input=$(cat)

model=$(echo "$input" | jq -r '.model.display_name // "Claude"')
cwd=$(echo "$input" | jq -r '.cwd // empty')
effort=$(echo "$input" | jq -r '.effort.level // empty')
thinking=$(echo "$input" | jq -r '.thinking.enabled // false')
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
ctx_used_tokens=$(echo "$input" | jq -r '(.context_window.total_input_tokens // 0) + (.context_window.total_output_tokens // 0)')
ctx_size_tokens=$(echo "$input" | jq -r '.context_window.context_window_size // empty')
five_hour_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
five_hour_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
seven_day_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
seven_day_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

RESET="\033[0m"
DIM="\033[38;5;240m"
FAINT="\033[38;5;244m"
GREEN="\033[38;5;114m"
YELLOW="\033[38;5;221m"
RED="\033[38;5;203m"
CYAN="\033[38;5;80m"
MAGENTA="\033[38;5;176m"
BLUE="\033[38;5;110m"

# pct → green/yellow/red color
pct_color() {
  local pct=$1
  if   [ "$pct" -ge 75 ]; then printf '%b' "$RED"
  elif [ "$pct" -ge 50 ]; then printf '%b' "$YELLOW"
  else                         printf '%b' "$GREEN"; fi
}

# 97923 → 97.9k, 1000000 → 1M
fmt_tokens() {
  local n=$1
  if   [ "$n" -ge 1000000 ]; then awk -v n="$n" 'BEGIN { v = n / 1000000; printf (v == int(v)) ? "%.0fM" : "%.1fM", v }'
  elif [ "$n" -ge 1000 ];    then awk -v n="$n" 'BEGIN { printf "%.1fk", n / 1000 }'
  else printf '%d' "$n"; fi
}

render_bar() {
  local pct=$1 bar_len=$2 color=$3
  local filled=$(( (pct * bar_len + 50) / 100 ))
  local empty=$(( bar_len - filled ))
  local bar=""
  [ "$filled" -gt 0 ] && for i in $(seq 1 $filled); do bar="${bar}▰"; done
  bar="${color}${bar}${RESET}${DIM}"
  [ "$empty" -gt 0 ] && for i in $(seq 1 $empty); do bar="${bar}▱"; done
  printf '%b%b' "$bar" "$RESET"
}

# Row 1: model + effort + thinking
printf "${MAGENTA}✦${RESET} ${CYAN}\033[1m%s${RESET}" "$model"
if [ -n "$effort" ]; then
  case "$effort" in
    low)            ecolor="$GREEN"  ;;
    medium)         ecolor="$CYAN"   ;;
    high|xhigh|max) ecolor="$RED"    ;;
    *)              ecolor="$MAGENTA";;
  esac
  printf " ${DIM}·${RESET} ${ecolor}⚡%s${RESET}" "$effort"
fi
if [ "$thinking" = "true" ]; then
  printf " ${DIM}·${RESET} ${MAGENTA}✻ think:on${RESET}"
else
  printf " ${DIM}·${RESET} ${DIM}✻ think:off${RESET}"
fi
printf "\n"

# Row 2: context bar
if [ -n "$used" ]; then
  used_int=$(printf "%.0f" "$used")
  color=$(pct_color "$used_int")
  printf "${FAINT}◍ ctx${RESET}  "
  render_bar "$used_int" 18 "$color"
  printf " ${color}%3d%%${RESET}" "$used_int"
  if [ "$ctx_used_tokens" -gt 0 ] && [ -n "$ctx_size_tokens" ]; then
    printf " ${DIM}⛁ %s/%s${RESET}" "$(fmt_tokens "$ctx_used_tokens")" "$(fmt_tokens "$ctx_size_tokens")"
  fi
fi
printf "\n"

# Row 3: 5h / 7d rate-limit bars
if [ -n "$five_hour_pct" ]; then
  pct_int=$(printf "%.0f" "$five_hour_pct")
  color=$(pct_color "$pct_int")
  printf "${FAINT}◔ 5h${RESET}   "
  render_bar "$pct_int" 18 "$color"
  printf " ${color}%3d%%${RESET}" "$pct_int"
  if [ -n "$five_hour_reset" ]; then
    reset_time=$(date -r "$five_hour_reset" +"%-I:%M%p" 2>/dev/null | tr '[:upper:]' '[:lower:]')
    [ -n "$reset_time" ] && printf " ${DIM}↻ %s${RESET}" "$reset_time"
  fi
fi
if [ -n "$seven_day_pct" ]; then
  pct_int=$(printf "%.0f" "$seven_day_pct")
  color=$(pct_color "$pct_int")
  [ -n "$five_hour_pct" ] && printf "  ${DIM}│${RESET}  "
  printf "${FAINT}◷ 7d${RESET} "
  render_bar "$pct_int" 18 "$color"
  printf " ${color}%d%%${RESET}" "$pct_int"
  if [ -n "$seven_day_reset" ]; then
    reset_time=$(date -r "$seven_day_reset" +"%d/%m %-I:%M%p" 2>/dev/null | tr '[:upper:]' '[:lower:]')
    [ -n "$reset_time" ] && printf " ${DIM}↻ %s${RESET}" "$reset_time"
  fi
fi
printf "\n"

# Row 4: cwd with ~ for $HOME
if [ -n "$cwd" ]; then
  printf "${BLUE}📁 %s${RESET}" "${cwd/#$HOME/~}"
fi
printf "\n"

# Row 5: git branch + commits ahead of origin/dev
if [ -n "$cwd" ] && git -C "$cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  branch=$(git -C "$cwd" branch --show-current 2>/dev/null)
  if [ -n "$branch" ]; then
    printf "${GREEN}⎇ %s${RESET}" "$branch"
    if git -C "$cwd" rev-parse --verify --quiet origin/dev >/dev/null 2>&1; then
      ahead=$(git -C "$cwd" rev-list --count origin/dev..HEAD 2>/dev/null)
      if [ -n "$ahead" ]; then
        if [ "$ahead" -gt 0 ]; then acolor="$YELLOW"; else acolor="$FAINT"; fi
        printf " ${DIM}·${RESET} ${acolor}↑%s vs origin/dev${RESET}" "$ahead"
      fi
    fi
  fi
fi
printf "\n"
