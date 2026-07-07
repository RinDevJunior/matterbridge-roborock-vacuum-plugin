#!/usr/bin/env bash
# Build, start matterbridge, and stream only log lines matching a keyword.
# Usage: scripts/watch-log.sh <keyword> [logfile]
#   keyword  grep -Ei pattern to filter stdout/stderr by (required)
#   logfile  path to also append matched lines to (default: logs/watch-log.log)
set -euo pipefail

KEYWORD="${1:?Usage: scripts/watch-log.sh <keyword> [logfile]}"
LOGFILE="${2:-logs/watch-log.log}"

mkdir -p "$(dirname "$LOGFILE")"

npm run build:local:ci

npm start 2>&1 | grep --line-buffered -Ei "$KEYWORD" | tee -a "$LOGFILE"
