#!/usr/bin/env bash
# translate-briefing.sh — Translate an English briefing to German using Claude Opus
#
# Usage:
#   ./translate-briefing.sh 2026-02-26                    ← translates today's briefing
#   ./translate-briefing.sh 2026-02-26 --dry-run          ← show what would be translated
#
# Requires: claude CLI
# Output: ~/icfi-work/briefing/daily/{DATE}_full_de.md
# Token report appended to: ~/icfi-work/briefing/logs/{DATE}_tokens.md

set -euo pipefail

CLAUDE="$HOME/.local/bin/claude"
WORK_DIR="$HOME/icfi-work"
BRIEFING_DIR="$WORK_DIR/briefing/daily"
LOGDIR="$WORK_DIR/briefing/logs"
SITE_DIR="$HOME/icfi-briefing-site"

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

EN_CONTENT="$(cat "$EN_FILE")"
EN_WORDS=$(echo "$EN_CONTENT" | wc -w | tr -d ' ')
log "English source: $EN_WORDS words"

# ── Translate using Claude Opus ───────────────────────────────────────────────

log "Translating to German using Claude Sonnet..."

TRANSLATE_START=$(date +%s)

# Use --output-format json to capture token usage
RESULT=$("$CLAUDE" -p "You are a professional German translator specializing in political journalism and international affairs. Translate the following English morning briefing into fluent, natural German.

CRITICAL RULES:
1. Translate ALL prose text into German — headings, body paragraphs, bullet points, coverage suggestions
2. Keep ALL HTML markup exactly as-is (div tags, class names, href URLs, target attributes, rel attributes)
3. Keep ALL URLs unchanged — do not translate URLs
4. Keep publication names in their original language (e.g., 'The New York Times' stays English, 'Der Spiegel' stays German)
5. Keep proper nouns (people's names, organization names, place names) in their commonly used form
6. Use formal German (Sie) for any reader-addressing text
7. Maintain the exact same Markdown structure — headings (##, ###), horizontal rules (---), bullet points, bold text
8. The source attribution blocks with class='source-links' must keep their HTML structure — only translate the label text 'Sources' to 'Quellen'
9. Translate 'What we\\'re covering today' to 'Was wir heute behandeln'
10. Translate 'What the WSWS should cover today' to 'Was die WSWS heute abdecken sollte'
11. Output ONLY the translated Markdown — no commentary, no notes, no preamble

Here is the English briefing to translate:

$EN_CONTENT" \
  --model sonnet \
  --output-format json \
  --max-turns 1 \
  --dangerously-skip-permissions \
  2>/dev/null) || die "Translation failed"

TRANSLATE_END=$(date +%s)
TRANSLATE_SECS=$((TRANSLATE_END - TRANSLATE_START))

# ── Extract result and token usage ────────────────────────────────────────────

# Parse the JSON output — extract the result text
# The claude CLI JSON output has a "result" field with the text
TRANSLATED=$(echo "$RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if isinstance(data, dict):
    print(data.get('result', data.get('text', data.get('content', ''))))
elif isinstance(data, str):
    print(data)
else:
    print(str(data))
" 2>/dev/null || echo "$RESULT")

# Try to extract token usage from JSON
USAGE_INFO=$(echo "$RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
usage = data.get('usage', {})
input_t = usage.get('input_tokens', 'unknown')
output_t = usage.get('output_tokens', 'unknown')
total = 'unknown'
if isinstance(input_t, int) and isinstance(output_t, int):
    total = input_t + output_t
print(f'input_tokens={input_t}')
print(f'output_tokens={output_t}')
print(f'total_tokens={total}')
" 2>/dev/null || echo "input_tokens=unknown
output_tokens=unknown
total_tokens=unknown")

INPUT_TOKENS=$(echo "$USAGE_INFO" | grep input_tokens | cut -d= -f2)
OUTPUT_TOKENS=$(echo "$USAGE_INFO" | grep output_tokens | cut -d= -f2)
TOTAL_TOKENS=$(echo "$USAGE_INFO" | grep total_tokens | cut -d= -f2)

# ── Save translated content ──────────────────────────────────────────────────

echo "$TRANSLATED" > "$DE_FILE"
DE_WORDS=$(wc -w < "$DE_FILE" | tr -d ' ')

log "Translation complete: $DE_WORDS words (${TRANSLATE_SECS}s)"
log "Tokens — input: $INPUT_TOKENS, output: $OUTPUT_TOKENS, total: $TOTAL_TOKENS"

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
  echo "| Input tokens | $INPUT_TOKENS |"
  echo "| Output tokens | $OUTPUT_TOKENS |"
  echo "| Total tokens | $TOTAL_TOKENS |"
  echo "| Duration | ${TRANSLATE_SECS}s |"
  echo "| Timestamp | $(date '+%Y-%m-%d %H:%M:%S') |"
  echo ""
} >> "$TOKEN_REPORT"

log "Token report updated: $TOKEN_REPORT"
echo ""
echo "✓ German translation saved to: $DE_FILE"
