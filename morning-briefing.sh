#!/usr/bin/env bash
# morning-briefing.sh — Automated daily briefing pipeline
#
# Runs three steps in sequence:
#   1. briefing-research agent → gathers raw material from WSWS + bourgeois press
#   2. briefing-writer agent  → synthesizes the final briefing
#   3. publish.sh             → converts to HTML and pushes to GitHub Pages
#
# Designed to run unattended via launchd at 6:00 AM Eastern.
# Logs to ~/icfi-work/briefing/logs/YYYY-MM-DD.log

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

CLAUDE="$HOME/.local/bin/claude"
WORK_DIR="$HOME/icfi-work"
SITE_DIR="$HOME/icfi-briefing-site"
LOGDIR="$WORK_DIR/briefing/logs"
DATE="$(date +%Y-%m-%d)"
DATE_HUMAN="$(date '+%B %-d, %Y')"
LOGFILE="$LOGDIR/$DATE.log"

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

# ── Step 1: Research ──────────────────────────────────────────────────────────

log "Step 1/3: Running briefing-research agent..."

"$CLAUDE" -p \
  "Today is $DATE_HUMAN. Use the briefing-research agent to gather all raw news material, WSWS articles, and source data for today's ($DATE) morning briefing. Save the structured raw material to briefing/daily/${DATE}_raw.md following the agent's output format. IMPORTANT: For every article and data point gathered, preserve the full source URL, publication name, article headline, and publication date — these are required for source attribution in the final briefing." \
  --dangerously-skip-permissions \
  >> "$LOGFILE" 2>&1 || die "Research agent failed (exit code $?)"

if [[ ! -f "$WORK_DIR/briefing/daily/${DATE}_raw.md" ]]; then
  die "Research agent completed but ${DATE}_raw.md was not created"
fi

RAW_SIZE="$(wc -c < "$WORK_DIR/briefing/daily/${DATE}_raw.md")"
log "Step 1 complete: ${DATE}_raw.md created (${RAW_SIZE} bytes)"

# ── Step 2: Writer ────────────────────────────────────────────────────────────

log "Step 2/3: Running briefing-writer agent..."

"$CLAUDE" -p \
  "Today is $DATE_HUMAN. Use the briefing-writer agent to synthesize the final daily briefing from the raw material in briefing/daily/${DATE}_raw.md. Save the finished briefing to briefing/daily/${DATE}_full.md. IMPORTANT: You MUST follow the formatting guide at briefing/briefing-format.md exactly. Key requirements: (1) Start with a 'What we\\'re covering today' summary section with 4-8 concise bullet points before the first horizontal rule. (2) Use sentence case for ALL headings — capitalize only the first word and proper nouns. (3) End each topic section with a source attribution block using the HTML format specified in the format guide, including publication names and article headlines linked to their URLs." \
  --dangerously-skip-permissions \
  >> "$LOGFILE" 2>&1 || die "Writer agent failed (exit code $?)"

if [[ ! -f "$WORK_DIR/briefing/daily/${DATE}_full.md" ]]; then
  die "Writer agent completed but ${DATE}_full.md was not created"
fi

FULL_SIZE="$(wc -c < "$WORK_DIR/briefing/daily/${DATE}_full.md")"
log "Step 2 complete: ${DATE}_full.md created (${FULL_SIZE} bytes)"

# ── Step 3: Publish ───────────────────────────────────────────────────────────

log "Step 3/3: Publishing to briefing site..."

"$SITE_DIR/publish.sh" "$DATE" >> "$LOGFILE" 2>&1 \
  || die "publish.sh failed (exit code $?)"

log "Step 3 complete: Published to GitHub Pages"

# ── Done ──────────────────────────────────────────────────────────────────────

ELAPSED="$SECONDS"
MINS=$((ELAPSED / 60))
log "==========================================="
log "  Pipeline complete in ${MINS} minutes"
log "  https://evanblake17.github.io/icfi-briefing-site/"
log "==========================================="

notify "Briefing ready for $DATE_HUMAN (${MINS}m)"
