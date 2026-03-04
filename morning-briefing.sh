#!/usr/bin/env bash
# morning-briefing.sh — Automated daily briefing pipeline
#
# Runs three steps in sequence:
#   1. briefing-research agent → gathers raw material from WSWS + bourgeois press
#   2. briefing-writer agent   → synthesizes the final briefing
#   3. publish.sh              → converts to HTML and pushes to GitHub Pages
#
# Step timing and output sizes are tracked and saved to a report.
#
# Designed to run unattended via launchd at 6:00 AM Eastern.
# Logs to ~/Projects/editorial/briefing/briefing/logs/YYYY-MM-DD.log
# Token report: ~/Projects/editorial/briefing/briefing/logs/YYYY-MM-DD_tokens.md

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

CLAUDE="$HOME/.local/bin/claude"
WORK_DIR="$HOME/Projects/editorial/briefing"
SITE_DIR="$HOME/Projects/editorial/briefing"
LOGDIR="$WORK_DIR/briefing/logs"
DATE="$(date +%Y-%m-%d)"
DATE_HUMAN="$(date '+%B %-d, %Y')"
LOGFILE="$LOGDIR/$DATE.log"
TOKEN_REPORT="$LOGDIR/${DATE}_tokens.md"

# Ensure PATH includes homebrew (for pandoc, gh) and local bin (for claude)
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Allow running from within a Claude Code session (e.g., manual re-runs)
unset CLAUDECODE 2>/dev/null || true

# Source credentials for headless (launchd) runs.
# The claude CLI needs CLAUDE_CODE_OAUTH_TOKEN — interactive shells get it
# from Claude Desktop, but launchd doesn't.  ~/.briefing-env provides it.
if [[ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" && -f "$HOME/.briefing-env" ]]; then
  # shellcheck source=/dev/null
  source "$HOME/.briefing-env"
fi

# ── Lockfile (prevent concurrent runs) ────────────────────────────────────────

LOCKFILE="$HOME/.briefing-pipeline.lock"

cleanup_lock() {
  rm -f "$LOCKFILE"
}

# Check for an existing lock. If the PID in the lockfile is still running, exit.
if [[ -f "$LOCKFILE" ]]; then
  LOCK_PID="$(cat "$LOCKFILE" 2>/dev/null || echo "")"
  if [[ -n "$LOCK_PID" ]] && kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "[$(date '+%H:%M:%S')] Another pipeline (PID $LOCK_PID) is already running — exiting." >> "${LOGDIR:-/tmp}/$DATE.log"
    exit 0
  fi
  # Stale lockfile — previous run crashed. Clean up and continue.
fi
echo $$ > "$LOCKFILE"
trap cleanup_lock EXIT

# ── Helpers ───────────────────────────────────────────────────────────────────

mkdir -p "$LOGDIR" "$WORK_DIR/briefing/daily"

# Truncate launchd stdout log on each run to prevent unbounded growth.
# The per-day log ($LOGFILE) is the durable record; launchd stdout is transient.
: > "$LOGDIR/launchd-stdout.log" 2>/dev/null || true

log() {
  echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOGFILE"
}

die() {
  log "FATAL: $*"
  osascript -e "display notification \"$*\" with title \"Briefing Pipeline Failed\"" 2>/dev/null || true
  exit 1
}

notify() {
  osascript -e "display notification \"$*\" with title \"Morning Briefing\"" 2>/dev/null || true
}

# Timeout wrapper: run_with_timeout <seconds> <command...>
# Kills the command if it exceeds the time limit.
run_with_timeout() {
  local timeout_secs="$1"
  shift
  "$@" &
  local cmd_pid=$!
  (
    sleep "$timeout_secs"
    if kill -0 "$cmd_pid" 2>/dev/null; then
      log "WARNING: Command timed out after ${timeout_secs}s — killing PID $cmd_pid"
      kill "$cmd_pid" 2>/dev/null
      sleep 5
      kill -9 "$cmd_pid" 2>/dev/null
    fi
  ) &
  local watchdog_pid=$!
  wait "$cmd_pid" 2>/dev/null
  local exit_code=$?
  kill "$watchdog_pid" 2>/dev/null
  wait "$watchdog_pid" 2>/dev/null
  return "$exit_code"
}

# Record a step's timing to the token report
# Usage: record_step "step_name" duration_secs [extra_info]
record_step() {
  local step_name="$1"
  local duration="$2"
  local extra="${3:-}"
  {
    echo ""
    echo "## $step_name"
    echo ""
    echo "| Metric | Value |"
    echo "|--------|-------|"
    echo "| Duration | ${duration}s ($(( duration / 60 ))m $(( duration % 60 ))s) |"
    echo "| Timestamp | $(date '+%Y-%m-%d %H:%M:%S') |"
    if [[ -n "$extra" ]]; then
      echo "$extra"
    fi
    echo ""
  } >> "$TOKEN_REPORT"
}

# ── Preflight checks ─────────────────────────────────────────────────────────

log "==========================================="
log "  Morning briefing pipeline: $DATE_HUMAN"
log "==========================================="

[[ -x "$CLAUDE" ]] || die "claude CLI not found at $CLAUDE"
command -v pandoc &>/dev/null || die "pandoc not found in PATH"
command -v git &>/dev/null || die "git not found in PATH"

# Skip if today's briefing is already published
if [[ -f "$SITE_DIR/briefings/$DATE.html" ]]; then
  log "Briefing for $DATE already published — skipping."
  exit 0
fi

# Pre-flight auth check — catch expired tokens early instead of after a long run.
# Uses haiku (cheapest/fastest model), disables tools and session persistence,
# and skips project settings to avoid loading agents/MCP config.
log "Preflight: Testing claude CLI authentication..."
AUTH_TEST=$("$CLAUDE" -p "Say OK" \
  --max-turns 1 \
  --model haiku \
  --tools "" \
  --no-session-persistence \
  --dangerously-skip-permissions \
  2>> "$LOGFILE") || die "claude CLI auth check failed — check CLAUDE_CODE_OAUTH_TOKEN in ~/.briefing-env"
log "Preflight: Auth OK"

# Initialize token report
{
  echo "# Token Usage Report: $DATE_HUMAN"
  echo ""
  echo "Pipeline run started at $(date '+%H:%M:%S')"
  echo ""
  echo "---"
} > "$TOKEN_REPORT"

# ── Step 1: Research ──────────────────────────────────────────────────────────

log "Step 1/3: Running briefing-research agent..."
STEP1_START=$(date +%s)

# Use --agent to run AS the briefing-research agent directly.
# IMPORTANT: Do NOT use --output-format json with --agent — it breaks multi-turn
# agent execution (discovered in commit 17c54c6, Feb 26). Agent output streams
# to the log file; success is determined by whether the raw file exists.
"$CLAUDE" -p \
  "Today is $DATE_HUMAN. Gather all raw news material, WSWS articles, and source data for today's ($DATE) morning briefing. Save the structured raw material to $WORK_DIR/briefing/daily/${DATE}_raw.md following the output format in your instructions. CRITICAL: Write the file INCREMENTALLY as instructed — write after Steps 1-2, update after Steps 3-5, update after Steps 6-7, and final update after Steps 8-10. Do NOT accumulate everything and write once at the end. IMPORTANT: (1) For every article and data point gathered, preserve the full source URL, publication name, article headline, and publication date — these are required for functional hyperlinks in the final briefing. (2) Gather bourgeois press FIRST to establish the objectively most important world events — top stories are determined by real-world significance, not WSWS coverage. (3) Gather dedicated science/technology/public health material (major studies, COVID/flu data, outbreak updates). (4) Gather world economy data — stock indices, gold/silver/oil prices, crypto, central bank decisions, major economic data releases. (5) Scan the pseudo-left press (Jacobin, Left Voice, PSL/Liberation News, Socialist Alternative, SWP UK, Socialist Appeal/RCP IMT) — collect 2-3 significant article headlines, URLs, and 1-2 sentence political summaries per tendency. (6) Gather arts and culture material — major film, literary, theater, music developments from the past 24 hours. (7) Provide at least 5 coverage gap suggestions in priority order, each with a potential headline, description, and source URL." \
  --agent briefing-research \
  --max-turns 80 \
  --dangerously-skip-permissions \
  >> "$LOGFILE" 2>&1 &
STEP1_PID=$!

# 90-minute timeout — kills the agent if it hangs
( sleep 5400
  if kill -0 "$STEP1_PID" 2>/dev/null; then
    log "WARNING: Research agent timed out after 90 minutes — killing PID $STEP1_PID"
    kill "$STEP1_PID" 2>/dev/null
    sleep 5
    kill -9 "$STEP1_PID" 2>/dev/null
  fi
) &
STEP1_WATCHDOG=$!

wait "$STEP1_PID" 2>/dev/null ; STEP1_EXIT=$?
kill "$STEP1_WATCHDOG" 2>/dev/null || true
wait "$STEP1_WATCHDOG" 2>/dev/null || true

# Check for the output file — the definitive success signal.
# Thanks to incremental writing, even a timed-out agent may have produced a partial file.
if [[ ! -f "$WORK_DIR/briefing/daily/${DATE}_raw.md" ]]; then
  log "WARNING: Research agent failed (exit code $STEP1_EXIT) — no raw file created. Attempting fallback..."

  # ── Fallback: stripped-down research pass ──────────────────────────────────
  # If the full research agent fails, run a minimal pass that only gathers
  # the most essential material: top news stories, WSWS articles, and market data.
  log "Step 1b/3: Running fallback research (essential sections only)..."

  "$CLAUDE" -p \
    "Today is $DATE_HUMAN. This is a FALLBACK research pass — keep it fast and focused. Gather ONLY the essential material for today's ($DATE) morning briefing and write it to $WORK_DIR/briefing/daily/${DATE}_raw.md. Do these 4 things ONLY: (1) Search for the top 8 world news stories from the past 24 hours — for each, record headline, 2-3 sentence summary, source URL, and publication name. (2) Check https://www.wsws.org/en/archive/recent for WSWS articles published in the past 24 hours — record title, author, URL, and 2-3 sentence summary for each. (3) Get market data: US stock indices, gold, oil, Bitcoin prices and percentage changes. (4) Write the file IMMEDIATELY with whatever you have gathered — use the standard section headers (Bourgeois Press, WSWS Articles, World Economy Data) and leave other sections as placeholders. Do NOT research pseudo-left press, arts/culture, or coverage gaps — skip those entirely. Write the file as soon as possible." \
    --agent briefing-research \
    --max-turns 30 \
    --dangerously-skip-permissions \
    >> "$LOGFILE" 2>&1 &
  STEP1B_PID=$!

  # 30-minute timeout for fallback
  ( sleep 1800
    if kill -0 "$STEP1B_PID" 2>/dev/null; then
      log "WARNING: Fallback research timed out after 30 minutes — killing PID $STEP1B_PID"
      kill "$STEP1B_PID" 2>/dev/null
      sleep 5
      kill -9 "$STEP1B_PID" 2>/dev/null
    fi
  ) &
  STEP1B_WATCHDOG=$!

  wait "$STEP1B_PID" 2>/dev/null ; STEP1B_EXIT=$?
  kill "$STEP1B_WATCHDOG" 2>/dev/null || true
  wait "$STEP1B_WATCHDOG" 2>/dev/null || true

  if [[ ! -f "$WORK_DIR/briefing/daily/${DATE}_raw.md" ]]; then
    die "Both research attempts failed — ${DATE}_raw.md was not created"
  fi
  log "Fallback research succeeded — continuing with partial raw material"
fi

if [[ $STEP1_EXIT -ne 0 ]]; then
  log "WARNING: Research agent exited with code $STEP1_EXIT but output file was created — continuing"
fi
# Sanity check: file should have at least 20 lines to be useful
RAW_LINE_COUNT="$(wc -l < "$WORK_DIR/briefing/daily/${DATE}_raw.md" | tr -d ' ')"
if [[ "$RAW_LINE_COUNT" -lt 20 ]]; then
  log "WARNING: Raw file has only $RAW_LINE_COUNT lines — may be incomplete but proceeding"
fi

# Measure total Step 1 time (includes fallback if it ran)
STEP1_END=$(date +%s)
STEP1_DUR=$((STEP1_END - STEP1_START))

RAW_SIZE="$(wc -c < "$WORK_DIR/briefing/daily/${DATE}_raw.md")"
RAW_LINES="$(wc -l < "$WORK_DIR/briefing/daily/${DATE}_raw.md" | tr -d ' ')"
log "Step 1 complete: ${DATE}_raw.md created (${RAW_SIZE} bytes, ${RAW_LINES} lines, ${STEP1_DUR}s)"
record_step "Step 1: Research Agent (Sonnet)" "$STEP1_DUR" "| Model | Claude Sonnet |
| Output size | ${RAW_SIZE} bytes (${RAW_LINES} lines) |"

# ── Step 2: Writer ────────────────────────────────────────────────────────────

log "Step 2/3: Running briefing-writer agent..."
STEP2_START=$(date +%s)

# Same --agent pattern: run AS the briefing-writer agent directly.
# 60-minute timeout. No --output-format json (breaks multi-turn agents).
"$CLAUDE" -p \
  "Today is $DATE_HUMAN. Synthesize the final daily briefing from the raw material in $WORK_DIR/briefing/daily/${DATE}_raw.md. Save the finished briefing to $WORK_DIR/briefing/daily/${DATE}_full.md. IMPORTANT: You MUST read and follow the formatting guide at $WORK_DIR/briefing/briefing-format.md exactly. Key requirements: (1) Every major section MUST open with section summary bullets — each bullet links to the item's heading and provides the most critical fact, NOT a restatement of the headline. (2) Use sentence case for ALL headings. (3) End each topic section with source attribution using the HTML format in the format guide — every link MUST include target=_blank rel=noopener. (4) Top stories must be objectively the most important world events — no WSWS-only stories in news sections. (5) Write a ~400-word world economy section (stocks, gold/silver/oil, crypto, economic data). (6) Write a ~500-word science/technology/public health section. (7) Write a ~500-word arts and culture section using the WSWS analytical framework. (8) Write a ~750-word pseudo-left press review covering Jacobin/DSA, Left Voice, PSL, Socialist Alternative, SWP UK, and Socialist Appeal/RCP IMT — 2-3 articles per tendency, political line identified, anti-Marxist positions flagged. (9) End with at least 5 coverage suggestions with headlines, descriptions, and source links. (10) Target ~10,000 words total." \
  --agent briefing-writer \
  --max-turns 30 \
  --dangerously-skip-permissions \
  >> "$LOGFILE" 2>&1 &
STEP2_PID=$!

( sleep 3600
  if kill -0 "$STEP2_PID" 2>/dev/null; then
    log "WARNING: Writer agent timed out after 60 minutes — killing PID $STEP2_PID"
    kill "$STEP2_PID" 2>/dev/null
    sleep 5
    kill -9 "$STEP2_PID" 2>/dev/null
  fi
) &
STEP2_WATCHDOG=$!

wait "$STEP2_PID" 2>/dev/null ; STEP2_EXIT=$?
kill "$STEP2_WATCHDOG" 2>/dev/null || true
wait "$STEP2_WATCHDOG" 2>/dev/null || true

STEP2_END=$(date +%s)
STEP2_DUR=$((STEP2_END - STEP2_START))

if [[ ! -f "$WORK_DIR/briefing/daily/${DATE}_full.md" ]]; then
  die "Writer agent failed (exit code $STEP2_EXIT): ${DATE}_full.md was not created"
fi
if [[ $STEP2_EXIT -ne 0 ]]; then
  log "WARNING: Writer agent exited with code $STEP2_EXIT but output file was created — continuing"
fi

FULL_SIZE="$(wc -c < "$WORK_DIR/briefing/daily/${DATE}_full.md")"
FULL_WORDS="$(wc -w < "$WORK_DIR/briefing/daily/${DATE}_full.md" | tr -d ' ')"
log "Step 2 complete: ${DATE}_full.md created (${FULL_SIZE} bytes, ${FULL_WORDS} words, ${STEP2_DUR}s)"
record_step "Step 2: Writer Agent (Opus)" "$STEP2_DUR" "| Model | Claude Opus |
| Output size | ${FULL_SIZE} bytes (${FULL_WORDS} words) |"

# ── Step 3: Publish ───────────────────────────────────────────────────────────

log "Step 3/3: Publishing to briefing site..."
STEP3_PUB_START=$(date +%s)

"$SITE_DIR/publish.sh" "$DATE" >> "$LOGFILE" 2>&1 \
  || die "publish.sh failed (exit code $?)"

STEP3_PUB_END=$(date +%s)
STEP3_PUB_DUR=$((STEP3_PUB_END - STEP3_PUB_START))

log "Step 3 complete: Published to GitHub Pages (${STEP3_PUB_DUR}s)"
record_step "Step 3: Publish" "$STEP3_PUB_DUR"

# ── Finalize token report ─────────────────────────────────────────────────────

ELAPSED="$SECONDS"
MINS=$((ELAPSED / 60))

{
  echo "---"
  echo ""
  echo "## Pipeline Summary"
  echo ""
  echo "| Metric | Value |"
  echo "|--------|-------|"
  echo "| Date | $DATE_HUMAN |"
  echo "| Total duration | ${MINS}m $((ELAPSED % 60))s |"
  echo "| Step 1 (Research/Sonnet) | ${STEP1_DUR}s |"
  echo "| Step 2 (Writer/Opus) | ${STEP2_DUR}s |"
  echo "| Step 3 (Publish) | ${STEP3_PUB_DUR}s |"
  echo "| English briefing | ${FULL_SIZE:-0} bytes (${FULL_WORDS:-0} words) |"
  echo "| Pipeline finished | $(date '+%H:%M:%S') |"
  echo ""
} >> "$TOKEN_REPORT"

# ── Done ──────────────────────────────────────────────────────────────────────

log "==========================================="
log "  Pipeline complete in ${MINS} minutes"
log "  Token report: $TOKEN_REPORT"
log "  https://evanblake17.github.io/icfi-briefing-site/"
log "==========================================="

notify "Briefing ready for $DATE_HUMAN (${MINS}m)"
