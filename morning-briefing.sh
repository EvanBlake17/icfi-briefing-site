#!/usr/bin/env bash
# morning-briefing.sh — Automated daily briefing pipeline
#
# Runs four steps in sequence:
#   1. briefing-research agent → gathers raw material from WSWS + bourgeois press
#   2. briefing-writer agent  → synthesizes the final briefing
#   3. translate-briefing.sh  → translates English → German using Claude Sonnet
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

# Allow running from within a Claude Code session (e.g., manual re-runs)
unset CLAUDECODE 2>/dev/null || true

# ── Helpers ───────────────────────────────────────────────────────────────────

mkdir -p "$LOGDIR" "$WORK_DIR/briefing/daily"

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
STEP1_START=$(date +%s)

"$CLAUDE" -p \
  "Today is $DATE_HUMAN. Use the briefing-research agent to gather all raw news material, WSWS articles, and source data for today's ($DATE) morning briefing. Save the structured raw material to briefing/daily/${DATE}_raw.md following the agent's output format. IMPORTANT: (1) For every article and data point gathered, preserve the full source URL, publication name, article headline, and publication date — these are required for functional hyperlinks in the final briefing. (2) Gather bourgeois press FIRST to establish the objectively most important world events — top stories are determined by real-world significance, not WSWS coverage. (3) Gather dedicated science/technology/public health material (major studies, COVID/flu data, outbreak updates). (4) Provide at least 5 coverage gap suggestions in priority order, each with a potential headline, description, and source URL." \
  --dangerously-skip-permissions \
  >> "$LOGFILE" 2>&1 || die "Research agent failed (exit code $?)"

STEP1_END=$(date +%s)
STEP1_DUR=$((STEP1_END - STEP1_START))

if [[ ! -f "$WORK_DIR/briefing/daily/${DATE}_raw.md" ]]; then
  die "Research agent completed but ${DATE}_raw.md was not created"
fi

RAW_SIZE="$(wc -c < "$WORK_DIR/briefing/daily/${DATE}_raw.md")"
log "Step 1 complete: ${DATE}_raw.md created (${RAW_SIZE} bytes, ${STEP1_DUR}s)"
record_step "Step 1: Research Agent" "$STEP1_DUR" "| Output size | ${RAW_SIZE} bytes |"

# ── Step 2: Writer ────────────────────────────────────────────────────────────

log "Step 2/4: Running briefing-writer agent..."
STEP2_START=$(date +%s)

"$CLAUDE" -p \
  "Today is $DATE_HUMAN. Use the briefing-writer agent to synthesize the final daily briefing from the raw material in briefing/daily/${DATE}_raw.md. Save the finished briefing to briefing/daily/${DATE}_full.md. IMPORTANT: You MUST read and follow the formatting guide at briefing/briefing-format.md exactly. Key requirements: (1) Start with a 'What we\\'re covering today' summary section with 4-8 concise bullet points before the first horizontal rule. (2) Use sentence case for ALL headings — capitalize only the first word and proper nouns. (3) End each topic section with a source attribution block using the HTML format specified in the format guide — every link MUST include target=_blank rel=noopener so links open in new tabs. (4) Top stories must be objectively the most important world events — do NOT put a story in Top stories if it is only covered by a single WSWS article. (5) Write a ~500-word science/technology/public health section with major studies, disease updates, and COVID/flu data. (6) End with a 'What the WSWS should cover today' section with at least 5 prioritized suggestions, each with a headline, description, and source link." \
  --dangerously-skip-permissions \
  >> "$LOGFILE" 2>&1 || die "Writer agent failed (exit code $?)"

STEP2_END=$(date +%s)
STEP2_DUR=$((STEP2_END - STEP2_START))

if [[ ! -f "$WORK_DIR/briefing/daily/${DATE}_full.md" ]]; then
  die "Writer agent completed but ${DATE}_full.md was not created"
fi

FULL_SIZE="$(wc -c < "$WORK_DIR/briefing/daily/${DATE}_full.md")"
log "Step 2 complete: ${DATE}_full.md created (${FULL_SIZE} bytes, ${STEP2_DUR}s)"
record_step "Step 2: Writer Agent" "$STEP2_DUR" "| Output size | ${FULL_SIZE} bytes |"

# ── Step 3: Translate to German ───────────────────────────────────────────────

log "Step 3/4: Translating briefing to German..."
STEP3_START=$(date +%s)

"$SITE_DIR/translate-briefing.sh" "$DATE" >> "$LOGFILE" 2>&1 || {
  log "WARNING: German translation failed — continuing with English only"
}

STEP3_END=$(date +%s)
STEP3_DUR=$((STEP3_END - STEP3_START))

if [[ -f "$WORK_DIR/briefing/daily/${DATE}_full_de.md" ]]; then
  DE_SIZE="$(wc -c < "$WORK_DIR/briefing/daily/${DATE}_full_de.md")"
  log "Step 3 complete: ${DATE}_full_de.md created (${DE_SIZE} bytes, ${STEP3_DUR}s)"
  # Token details are appended by translate-briefing.sh itself
else
  log "Step 3 skipped: No German translation produced (${STEP3_DUR}s)"
  record_step "Step 3: Translation (skipped)" "$STEP3_DUR"
fi

# ── Step 4: Publish ───────────────────────────────────────────────────────────

log "Step 4/4: Publishing to briefing site..."
STEP4_START=$(date +%s)

"$SITE_DIR/publish.sh" "$DATE" >> "$LOGFILE" 2>&1 \
  || die "publish.sh failed (exit code $?)"

STEP4_END=$(date +%s)
STEP4_DUR=$((STEP4_END - STEP4_START))

log "Step 4 complete: Published to GitHub Pages (${STEP4_DUR}s)"
record_step "Step 4: Publish" "$STEP4_DUR"

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
  echo "| Step 1 (Research) | ${STEP1_DUR}s |"
  echo "| Step 2 (Writer) | ${STEP2_DUR}s |"
  echo "| Step 3 (Translate) | ${STEP3_DUR}s |"
  echo "| Step 4 (Publish) | ${STEP4_DUR}s |"
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
