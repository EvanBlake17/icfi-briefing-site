#!/usr/bin/env bash
# test-research-pipeline.sh — One-shot test of the parallel research step
#
# Tests ONLY the 6 parallel claude -p calls that failed on March 6.
# Does NOT run the writer agent or publish anything.
# Designed to run once via launchd, then the plist auto-unloads.

set -euo pipefail

CLAUDE="$HOME/.local/bin/claude"
WORK_DIR="$HOME/Projects/editorial/briefing"
LOGDIR="$WORK_DIR/briefing/logs"
DATE="$(date +%Y-%m-%d)"
DATE_HUMAN="$(date '+%B %-d, %Y')"
LOGFILE="$LOGDIR/${DATE}_test.log"

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
unset CLAUDECODE 2>/dev/null || true

if [[ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" && -f "$HOME/.briefing-env" ]]; then
  source "$HOME/.briefing-env"
fi

log() {
  echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOGFILE"
}

notify() {
  osascript -e "display notification \"$*\" with title \"Pipeline Test\"" 2>/dev/null || true
}

# ── Start ────────────────────────────────────────────────────────────────────

log "==========================================="
log "  PIPELINE TEST: parallel research calls"
log "==========================================="

# Auth check
log "Auth check..."
AUTH=$("$CLAUDE" -p "Say OK" \
  --max-turns 1 --model haiku --tools "" \
  --no-session-persistence --dangerously-skip-permissions \
  2>> "$LOGFILE") || { log "FATAL: Auth failed"; notify "Test FAILED: auth"; exit 1; }
log "Auth: OK"

RESEARCH_TMP=$(mktemp -d /tmp/briefing-test-XXXXXXXX)
log "Temp dir: $RESEARCH_TMP"

# ── research_call: launch a focused claude -p call in background ─────────────
#
# IMPORTANT: Call this function DIRECTLY — never inside $() command substitution.
# Background processes launched in a $() subshell become orphans that the main
# shell cannot wait on (you get exit 127 from wait).
# After calling, read the PID from the global _RESEARCH_PID.

_RESEARCH_PID=0

research_call() {
  local name="$1" max_turns="$2" outfile="$3"
  shift 3
  local prompt="$*"

  log "  $name: Starting..."
  ( cd /tmp && "$CLAUDE" -p "$prompt" \
      --max-turns "$max_turns" \
      --model sonnet \
      --no-session-persistence \
      --dangerously-skip-permissions \
  ) > "$outfile" 2>> "$LOGFILE" &
  _RESEARCH_PID=$!
}

wait_step() {
  local pid="$1" name="$2" outfile="$3"
  local exit_code=0
  wait "$pid" 2>/dev/null || exit_code=$?
  local lines=0
  [[ -f "$outfile" ]] && lines=$(wc -l < "$outfile" | tr -d ' ')
  local bytes=0
  [[ -f "$outfile" ]] && bytes=$(wc -c < "$outfile" | tr -d ' ')
  if [[ $exit_code -eq 0 && $lines -gt 3 ]]; then
    log "  $name: OK (exit 0, $lines lines, $bytes bytes)"
  elif [[ $lines -gt 3 ]]; then
    log "  $name: Warning (exit $exit_code, $lines lines, $bytes bytes)"
  else
    log "  $name: FAILED (exit $exit_code, $lines lines, $bytes bytes)"
    log "  $name: Last 5 log lines:"
    tail -5 "$LOGFILE" | while read -r line; do log "    $line"; done
  fi
}

# ── Launch 6 parallel research calls (shorter prompts for testing) ───────────

log "Launching 6 parallel research calls..."
START=$(date +%s)

research_call "1b-news" 5 "$RESEARCH_TMP/01-news.md" \
"Today is $DATE_HUMAN. Search for the 5 most significant world news stories from the past 24 hours. For each: headline, source URL, 2-3 key facts. Print directly — do NOT write files."
PID_NEWS=$_RESEARCH_PID

research_call "1c-wsws" 5 "$RESEARCH_TMP/02-wsws.md" \
"Today is $DATE_HUMAN. Fetch https://www.wsws.org/en/archive/recent and list all articles published today or yesterday. For each: title, author, URL, one-sentence summary. Print directly — do NOT write files."
PID_WSWS=$_RESEARCH_PID

research_call "1d-science" 3 "$RESEARCH_TMP/03-science.md" \
"Today is $DATE_HUMAN. Search for 3 notable science or health news stories from the past 48 hours. For each: headline, source URL, key finding. Print directly — do NOT write files."
PID_SCIENCE=$_RESEARCH_PID

research_call "1e-economy" 3 "$RESEARCH_TMP/04-economy.md" \
"Today is $DATE_HUMAN. Search for the latest US stock market closing data (Dow, S&P 500, Nasdaq) and oil prices. Print directly — do NOT write files."
PID_ECONOMY=$_RESEARCH_PID

research_call "1f-pseudoleft" 3 "$RESEARCH_TMP/05-pseudoleft.md" \
"Today is $DATE_HUMAN. Fetch https://jacobin.com and list the 3 most recent article headlines and URLs. Print directly — do NOT write files."
PID_PSEUDO=$_RESEARCH_PID

research_call "1g-arts" 3 "$RESEARCH_TMP/06-arts.md" \
"Today is $DATE_HUMAN. Search for 2-3 notable arts, culture, or entertainment news stories from the past 48 hours. For each: headline, source URL, one-sentence summary. Print directly — do NOT write files."
PID_ARTS=$_RESEARCH_PID

ALL_PIDS="$PID_NEWS $PID_WSWS $PID_SCIENCE $PID_ECONOMY $PID_PSEUDO $PID_ARTS"
log "  PIDs: $ALL_PIDS"

# 5-minute timeout for test
( sleep 300
  for pid in $ALL_PIDS; do
    if kill -0 "$pid" 2>/dev/null; then
      log "WARNING: PID $pid timed out — killing"
      kill "$pid" 2>/dev/null; sleep 3; kill -9 "$pid" 2>/dev/null
    fi
  done
) &
WATCHDOG=$!

log "Waiting for results..."
wait_step "$PID_NEWS"    "1b-news"       "$RESEARCH_TMP/01-news.md"
wait_step "$PID_WSWS"    "1c-wsws"       "$RESEARCH_TMP/02-wsws.md"
wait_step "$PID_SCIENCE" "1d-science"    "$RESEARCH_TMP/03-science.md"
wait_step "$PID_ECONOMY" "1e-economy"    "$RESEARCH_TMP/04-economy.md"
wait_step "$PID_PSEUDO"  "1f-pseudoleft" "$RESEARCH_TMP/05-pseudoleft.md"
wait_step "$PID_ARTS"    "1g-arts"       "$RESEARCH_TMP/06-arts.md"

kill "$WATCHDOG" 2>/dev/null || true
wait "$WATCHDOG" 2>/dev/null || true

END=$(date +%s)
DUR=$((END - START))

# ── Report ───────────────────────────────────────────────────────────────────

log ""
log "==========================================="
log "  TEST RESULTS (${DUR}s total)"
log "==========================================="

PASS=0; FAIL=0
for f in "$RESEARCH_TMP"/*.md; do
  name=$(basename "$f")
  lines=$(wc -l < "$f" | tr -d ' ')
  bytes=$(wc -c < "$f" | tr -d ' ')
  if [[ $lines -gt 3 ]]; then
    log "  $name: $lines lines, $bytes bytes -- PASS"
    ((PASS++))
  else
    log "  $name: $lines lines, $bytes bytes -- FAIL"
    ((FAIL++))
  fi
done

log ""
log "  Passed: $PASS/6   Failed: $FAIL/6"
log "  Temp dir preserved at: $RESEARCH_TMP"
log "==========================================="

if [[ $FAIL -eq 0 ]]; then
  notify "Pipeline test PASSED: all 6 research calls succeeded (${DUR}s)"
else
  notify "Pipeline test: $PASS/6 passed, $FAIL/6 failed (${DUR}s)"
fi

# Clean up test launchd plist (one-shot)
launchctl bootout "gui/$(id -u)/com.icfi.briefing-test" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/com.icfi.briefing-test.plist" 2>/dev/null || true
