#!/usr/bin/env bash
# translate-briefing.sh — Translate an English briefing to German using Claude Sonnet
#
# Usage:
#   ./translate-briefing.sh 2026-02-26                    ← translates today's briefing
#   ./translate-briefing.sh 2026-02-26 --dry-run          ← show what would be translated
#
# Requires: claude CLI (authenticated via `claude setup-token`)
# Output: ~/Projects/editorial/briefing/briefing/daily/{DATE}_full_de.md
# Token report appended to: ~/Projects/editorial/briefing/briefing/logs/{DATE}_tokens.md

set -euo pipefail

# Allow running from within a Claude Code session
unset CLAUDECODE 2>/dev/null || true

# Source credentials for headless (launchd) runs
if [[ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" && -f "$HOME/.briefing-env" ]]; then
  # shellcheck source=/dev/null
  source "$HOME/.briefing-env"
fi

CLAUDE="$HOME/.local/bin/claude"
WORK_DIR="$HOME/Projects/editorial/briefing"
BRIEFING_DIR="$WORK_DIR/briefing/daily"
LOGDIR="$WORK_DIR/briefing/logs"
SITE_DIR="$HOME/Projects/editorial/briefing"

# ── Helpers ───────────────────────────────────────────────────────────────────

die() { echo "Error: $*" >&2; exit 1; }

log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

# ── Resolve input ─────────────────────────────────────────────────────────────

[[ $# -lt 1 ]] && die "Usage: $0 YYYY-MM-DD [--dry-run]"

DATE="$1"
DRY_RUN="${2:-}"

[[ "$DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die "Invalid date format: $DATE (expected YYYY-MM-DD)"

# Find the English source
EN_FILE=""
if [[ -f "$BRIEFING_DIR/${DATE}_full.md" ]]; then
  EN_FILE="$BRIEFING_DIR/${DATE}_full.md"
elif [[ -f "$SITE_DIR/md/$DATE.md" ]]; then
  EN_FILE="$SITE_DIR/md/$DATE.md"
else
  die "No English briefing found for $DATE"
fi

DE_FILE="$BRIEFING_DIR/${DATE}_full_de.md"
TOKEN_REPORT="$LOGDIR/${DATE}_tokens.md"

log "Source: $EN_FILE"
log "Target: $DE_FILE"

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  EN_WORDS=$(wc -w < "$EN_FILE" | tr -d ' ')
  echo "Dry run — would translate $EN_WORDS words from English to German"
  echo "  Source: $EN_FILE"
  echo "  Output: $DE_FILE"
  exit 0
fi

# Skip if already translated
if [[ -f "$DE_FILE" ]]; then
  log "German translation already exists at $DE_FILE — skipping"
  exit 0
fi

# ── Ensure directories exist ──────────────────────────────────────────────────

mkdir -p "$LOGDIR" "$BRIEFING_DIR"

# ── Read English content ──────────────────────────────────────────────────────

EN_WORDS=$(wc -w < "$EN_FILE" | tr -d ' ')
log "English source: $EN_WORDS words"

# ── Build prompt file ────────────────────────────────────────────────────────
# Write the full prompt to a temp file to avoid a 70KB shell argument

PROMPT_FILE="$(mktemp /tmp/translate-prompt-XXXXXX)"
trap 'rm -f "$PROMPT_FILE"' EXIT

cat > "$PROMPT_FILE" <<'RULES_EOF'
Translate the following English morning briefing into fluent, natural German. Rules:
1. Translate ALL prose text — headings, body, bullets, coverage suggestions
2. Keep ALL HTML markup exactly as-is (tags, class names, href URLs, target/rel attributes)
3. Keep ALL URLs unchanged
4. Keep publication names in original language (e.g., 'The New York Times' stays English)
5. Keep proper nouns in commonly used form
6. Use formal German (Sie)
7. Maintain exact Markdown structure (##, ###, ---, bullets, bold)
8. Translate 'Sources' to 'Quellen' in source-links blocks
9. Translate 'What the WSWS should cover today' → 'Was die WSWS heute abdecken sollte'
11. Output ONLY the translated Markdown — no commentary, no notes, no preamble

RULES_EOF

cat "$EN_FILE" >> "$PROMPT_FILE"

# ── Translate ────────────────────────────────────────────────────────────────
# Run from /tmp to avoid loading project CLAUDE.md, agents, and tool definitions.
# This cuts thousands of unnecessary input tokens from the system prompt.

log "Translating to German using Claude Sonnet..."
TRANSLATE_START=$(date +%s)

(cd /tmp && "$CLAUDE" -p "$(cat "$PROMPT_FILE")" \
  --model sonnet \
  --max-turns 1 \
  --dangerously-skip-permissions \
  2>/dev/null) > "$DE_FILE" || die "Translation failed"

TRANSLATE_END=$(date +%s)
TRANSLATE_SECS=$((TRANSLATE_END - TRANSLATE_START))

# ── Validate output ─────────────────────────────────────────────────────────

DE_WORDS=$(wc -w < "$DE_FILE" | tr -d ' ')

# Sanity check: translated output should be at least 60% of source length
MIN_WORDS=$(( EN_WORDS * 60 / 100 ))
if [[ "$DE_WORDS" -lt "$MIN_WORDS" ]]; then
  rm -f "$DE_FILE"
  die "Translation too short ($DE_WORDS words vs $EN_WORDS source) — likely failed"
fi

log "Translation complete: $DE_WORDS words (${TRANSLATE_SECS}s)"

# ── Append to token report ────────────────────────────────────────────────────

{
  echo ""
  echo "## Translation: English → German"
  echo ""
  echo "| Metric | Value |"
  echo "|--------|-------|"
  echo "| Model | Claude Sonnet |"
  echo "| Source words | $EN_WORDS |"
  echo "| Translated words | $DE_WORDS |"
  echo "| Duration | ${TRANSLATE_SECS}s ($(( TRANSLATE_SECS / 60 ))m $(( TRANSLATE_SECS % 60 ))s) |"
  echo "| Timestamp | $(date '+%Y-%m-%d %H:%M:%S') |"
  echo ""
} >> "$TOKEN_REPORT"

log "Token report updated: $TOKEN_REPORT"
echo ""
echo "✓ German translation saved to: $DE_FILE"
