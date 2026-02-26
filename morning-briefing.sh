#!/usr/bin/env bash
# morning-briefing.sh — Automated daily briefing pipeline
#
# Runs four steps in sequence:
#   1. briefing-research agent → gathers raw material from WSWS + bourgeois press
#   2. briefing-writer agent  → synthesizes the final briefing
#   3. translate-briefing.sh  → translates English → German using Claude Opus
#   4. publish.sh             → converts to HTML and pushes to GitHub Pages
#
# Token usage is tracked for each Claude invocation and saved to a report.
#
# Designed to run unattended via launchd at 6:00 AM Eastern.
# Logs to ~/icfi-work/briefing/logs/YYYY-MM-DD.log
# Token report: ~/icfi-work/briefing/logs/YYYY-MM-DD_tokens.md

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

CLAUDE="$HOME/.local/bin/claude"
WORK_DIR="$HOME/icfi-work"
SITE_DIR="$HOME/icfi-briefing-site"
LOGDIR="$WORK_DIR/briefing/logs"
DATE="$(date +%Y-%m-%d)"
DATE_HUMAN="$(date '+%B %-d, %Y')"
LOGFILE="$LOGDIR/$DATE.log"
TOKEN_REPORT="$LOGDIR/${DATE}_tokens.md"

# Ensure PATH includes homebrew (for pandoc, gh) and local bin (for claude)
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# ── Helpers ───────────────────────────────────────────────────────────────────

mkdir -p "$LOGDIR" "$WORK_DIR/briefing/daily"

log() {
  echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOGFILE"
}

die() {
  log "FATAL: $*"
  # Send a macOS notification on failure so the user sees it
  osascript -e "display notification \"$*\" with title \"Briefing Pipeline Failed\"" 2>/dev/null || true
  exit 1
}

notify() {
  osascript -e "display notification \"$*\" with title \"Morning Briefing\"" 2>/dev/null || true
}

# Run a claude command and capture token usage from JSON output
# Usage: run_claude_tracked "step_name" "prompt" [extra_args...]
# Sets: STEP_INPUT_TOKENS, STEP_OUTPUT_TOKENS, STEP_TOTAL_TOKENS, STEP_DURATION
run_claude_tracked() {
  local step_name="$1"
  local prompt="$2"
  shift 2
  local extra_args=("$@")

  local start_time=$(date +%s)
  local json_out
  local result_file=$(mktemp /tmp/claude-result-XXXXXX.json)

  # Run claude with JSON output to capture token usage
  "$CLAUDE" -p "$prompt" \
    --output-format json \
    --dangerously-skip-permissions \
    "${extra_args[@]}" \
    > "$result_file" 2>> "$LOGFILE" || {
    rm -f "$result_file"
    return 1
  }

  local end_time=$(date +%s)
  STEP_DURATION=$((end_time - start_time))

  # Extract token usage from JSON
  STEP_INPUT_TOKENS=$(python3 -c "
import json, sys
try:
    data = json.load(open('$result_file'))
    # Try different JSON structures the CLI might produce
    if isinstance(data, dict):
        usage = data.get('usage', {})
        if usage:
            print(usage.get('input_tokens', 'unknown'))
        else:
            # Try costUSD or other indicators
            cost = data.get('costUSD', data.get('cost', {}))
            print('see-log')
    else:
        print('unknown')
except:
    print('unknown')
" 2>/dev/null || echo "unknown")

  STEP_OUTPUT_TOKENS=$(python3 -c "
import json, sys
try:
    data = json.load(open('$result_file'))
    if isinstance(data, dict):
        usage = data.get('usage', {})
        print(usage.get('output_tokens', 'unknown'))
    else:
        print('unknown')
except:
    print('unknown')
" 2>/dev/null || echo "unknown")

  if [[ "$STEP_INPUT_TOKENS" != "unknown" && "$STEP_OUTPUT_TOKENS" != "unknown" && "$STEP_INPUT_TOKENS" != "see-log" ]]; then
    STEP_TOTAL_TOKENS=$((STEP_INPUT_TOKENS + STEP_OUTPUT_TOKENS))
  else
    STEP_TOTAL_TOKENS="unknown"
  fi

  # Also try to get the full JSON structure for the report
  local json_summary
  json_summary=$(python3 -c "
import json, sys
try:
    data = json.load(open('$result_file'))
    if isinstance(data, dict):
        # Extract all usage-related fields
        report = {}
        for key in ['usage', 'costUSD', 'cost', 'model', 'sessionId', 'numTurns']:
            if key in data:
                report[key] = data[key]
        if report:
            print(json.dumps(report, indent=2))
        else:
            print(json.dumps({k: v for k, v in data.items() if k != 'result'}, indent=2))
except:
    print('{}')
" 2>/dev/null || echo "{}")

  # Write to token report
  {
    echo ""
    echo "## $step_name"
    echo ""
    echo "| Metric | Value |"
    echo "|--------|-------|"
    echo "| Input tokens | $STEP_INPUT_TOKENS |"
    echo "| Output tokens | $STEP_OUTPUT_TOKENS |"
    echo "| Total tokens | $STEP_TOTAL_TOKENS |"
    echo "| Duration | ${STEP_DURATION}s ($(( STEP_DURATION / 60 ))m $(( STEP_DURATION % 60 ))s) |"
    echo "| Timestamp | $(date '+%Y-%m-%d %H:%M:%S') |"
    echo ""
    echo "<details><summary>Raw JSON metadata</summary>"
    echo ""
    echo '```json'
    echo "$json_summary"
    echo '```'
    echo ""
    echo "</details>"
    echo ""
  } >> "$TOKEN_REPORT"

  log "  $step_name tokens — input: $STEP_INPUT_TOKENS, output: $STEP_OUTPUT_TOKENS, total: $STEP_TOTAL_TOKENS (${STEP_DURATION}s)"

  rm -f "$result_file"
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

# Initialize token report
{
  echo "# Token Usage Report: $DATE_HUMAN"
  echo ""
  echo "Pipeline run started at $(date '+%H:%M:%S')"
  echo ""
  echo "---"
} > "$TOKEN_REPORT"

# ── Step 1: Research ──────────────────────────────────────────────────────────

log "Step 1/4: Running briefing-research agent..."

run_claude_tracked "Step 1: Research Agent" \
  "Today is $DATE_HUMAN. Use the briefing-research agent to gather all raw news material, WSWS articles, and source data for today's ($DATE) morning briefing. Save the structured raw material to briefing/daily/${DATE}_raw.md following the agent's output format. IMPORTANT: (1) For every article and data point gathered, preserve the full source URL, publication name, article headline, and publication date — these are required for functional hyperlinks in the final briefing. (2) Gather bourgeois press FIRST to establish the objectively most important world events — top stories are determined by real-world significance, not WSWS coverage. (3) Gather dedicated science/technology/public health material (major studies, COVID/flu data, outbreak updates). (4) Provide at least 5 coverage gap suggestions in priority order, each with a potential headline, description, and source URL." \
  || die "Research agent failed (exit code $?)"

if [[ ! -f "$WORK_DIR/briefing/daily/${DATE}_raw.md" ]]; then
  die "Research agent completed but ${DATE}_raw.md was not created"
fi

RAW_SIZE="$(wc -c < "$WORK_DIR/briefing/daily/${DATE}_raw.md")"
log "Step 1 complete: ${DATE}_raw.md created (${RAW_SIZE} bytes)"

# ── Step 2: Writer ────────────────────────────────────────────────────────────

log "Step 2/4: Running briefing-writer agent..."

run_claude_tracked "Step 2: Writer Agent" \
  "Today is $DATE_HUMAN. Use the briefing-writer agent to synthesize the final daily briefing from the raw material in briefing/daily/${DATE}_raw.md. Save the finished briefing to briefing/daily/${DATE}_full.md. IMPORTANT: You MUST read and follow the formatting guide at briefing/briefing-format.md exactly. Key requirements: (1) Start with a 'What we\\'re covering today' summary section with 4-8 concise bullet points before the first horizontal rule. (2) Use sentence case for ALL headings — capitalize only the first word and proper nouns. (3) End each topic section with a source attribution block using the HTML format specified in the format guide — every link MUST include target=_blank rel=noopener so links open in new tabs. (4) Top stories must be objectively the most important world events — do NOT put a story in Top stories if it is only covered by a single WSWS article. (5) Write a ~500-word science/technology/public health section with major studies, disease updates, and COVID/flu data. (6) End with a 'What the WSWS should cover today' section with at least 5 prioritized suggestions, each with a headline, description, and source link." \
  || die "Writer agent failed (exit code $?)"

if [[ ! -f "$WORK_DIR/briefing/daily/${DATE}_full.md" ]]; then
  die "Writer agent completed but ${DATE}_full.md was not created"
fi

FULL_SIZE="$(wc -c < "$WORK_DIR/briefing/daily/${DATE}_full.md")"
log "Step 2 complete: ${DATE}_full.md created (${FULL_SIZE} bytes)"

# ── Step 3: Translate to German ───────────────────────────────────────────────

log "Step 3/4: Translating briefing to German..."

"$SITE_DIR/translate-briefing.sh" "$DATE" >> "$LOGFILE" 2>&1 || {
  log "WARNING: German translation failed — continuing with English only"
  # Translation failure is non-fatal; the English briefing still publishes
}

if [[ -f "$WORK_DIR/briefing/daily/${DATE}_full_de.md" ]]; then
  DE_SIZE="$(wc -c < "$WORK_DIR/briefing/daily/${DATE}_full_de.md")"
  log "Step 3 complete: ${DATE}_full_de.md created (${DE_SIZE} bytes)"
else
  log "Step 3 skipped: No German translation produced"
fi

# ── Step 4: Publish ───────────────────────────────────────────────────────────

log "Step 4/4: Publishing to briefing site..."

"$SITE_DIR/publish.sh" "$DATE" >> "$LOGFILE" 2>&1 \
  || die "publish.sh failed (exit code $?)"

log "Step 4 complete: Published to GitHub Pages"

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
  echo "| Steps completed | 4/4 |"
  echo "| English briefing | ${FULL_SIZE:-0} bytes |"
  if [[ -f "$WORK_DIR/briefing/daily/${DATE}_full_de.md" ]]; then
    echo "| German translation | ${DE_SIZE:-0} bytes |"
  else
    echo "| German translation | skipped |"
  fi
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
