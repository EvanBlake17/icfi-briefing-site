#!/usr/bin/env bash
# publish.sh — Convert a markdown briefing to HTML and publish to GitHub Pages
#
# Usage:
#   ./publish.sh 2026-02-26                    ← looks for ~/icfi-work/briefing/daily/2026-02-26_full.md
#   ./publish.sh path/to/any-file.md           ← explicit path (filename must start with YYYY-MM-DD)
#   ./publish.sh 2026-02-26 "commit message"   ← optional custom commit message
#
# Requirements: pandoc (brew install pandoc)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIEFING_DIR="$HOME/icfi-work/briefing/daily"

# ── Helpers ───────────────────────────────────────────────────────────────────

usage() {
  echo "Usage:"
  echo "  $0 YYYY-MM-DD                  # uses ~/icfi-work/briefing/daily/YYYY-MM-DD_full.md"
  echo "  $0 path/to/YYYY-MM-DD*.md      # explicit file path"
  echo "  $0 YYYY-MM-DD \"commit message\" # optional commit message"
  exit 1
}

die() { echo "Error: $*" >&2; exit 1; }

# Format YYYY-MM-DD → "Month D, YYYY"
format_date() {
  local d="$1"
  # macOS (BSD date)
  if date -j -f "%Y-%m-%d" "$d" "+%B %-d, %Y" 2>/dev/null; then
    return
  fi
  # Linux (GNU date)
  if date -d "$d" "+%B %-d, %Y" 2>/dev/null; then
    return
  fi
  echo "$d"
}

# Strip a leading # H1 heading (used as masthead — redundant in HTML output)
strip_leading_heading() {
  local file="$1"
  local tmpfile
  tmpfile="$(mktemp /tmp/briefing-XXXXXX.md)"
  # Remove first line if it starts with "# "
  awk 'NR==1 && /^# / { next } NR==2 && /^$/ { next } { print }' "$file" > "$tmpfile"
  echo "$tmpfile"
}

# ── Resolve input → MDFILE + DATE ─────────────────────────────────────────────

[[ $# -lt 1 ]] && usage

COMMIT_MSG="${2:-}"
INPUT="$1"

# If input looks like a bare date (YYYY-MM-DD), resolve to standard path
if [[ "$INPUT" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  DATE="$INPUT"
  if [[ -f "$BRIEFING_DIR/${DATE}_full.md" ]]; then
    MDFILE="$BRIEFING_DIR/${DATE}_full.md"
  elif [[ -f "$BRIEFING_DIR/${DATE}.md" ]]; then
    MDFILE="$BRIEFING_DIR/${DATE}.md"
  else
    die "No briefing found for $DATE. Looked for:
  $BRIEFING_DIR/${DATE}_full.md
  $BRIEFING_DIR/${DATE}.md"
  fi
else
  # Explicit file path — extract date from start of filename
  MDFILE="$INPUT"
  [[ -f "$MDFILE" ]] || die "File not found: $MDFILE"
  BASENAME="$(basename "$MDFILE")"
  if [[ "$BASENAME" =~ ^([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then
    DATE="${BASH_REMATCH[1]}"
  else
    die "Filename must start with YYYY-MM-DD (got: $BASENAME)"
  fi
fi

DATE_FORMATTED="$(format_date "$DATE")"
echo "Publishing briefing: $DATE_FORMATTED"

# ── Setup ─────────────────────────────────────────────────────────────────────

mkdir -p "$SCRIPT_DIR/briefings" "$SCRIPT_DIR/md"

# Strip leading H1 heading into a temp file for pandoc
TMPFILE="$(strip_leading_heading "$MDFILE")"
trap 'rm -f "$TMPFILE"' EXIT

# Save a clean copy (heading stripped) into the repo's md/ for future regeneration
cp "$TMPFILE" "$SCRIPT_DIR/md/$DATE.md"

# ── Generate briefing page ────────────────────────────────────────────────────

echo "→ briefings/$DATE.html"

pandoc "$TMPFILE" \
  --template="$SCRIPT_DIR/templates/briefing.html" \
  --variable="root:../" \
  --variable="date:$DATE_FORMATTED" \
  --variable="isodate:$DATE" \
  --to=html5 \
  --output="$SCRIPT_DIR/briefings/$DATE.html"

# ── Determine latest briefing ─────────────────────────────────────────────────

LATEST_DATE=""
for f in "$SCRIPT_DIR"/briefings/*.html; do
  [[ -f "$f" ]] || continue
  d="$(basename "$f" .html)"
  [[ "$d" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || continue
  if [[ -z "$LATEST_DATE" || "$d" > "$LATEST_DATE" ]]; then
    LATEST_DATE="$d"
  fi
done

# ── Generate index.html (latest briefing at root) ─────────────────────────────

if [[ -n "$LATEST_DATE" && -f "$SCRIPT_DIR/md/$LATEST_DATE.md" ]]; then
  LATEST_FORMATTED="$(format_date "$LATEST_DATE")"
  echo "→ index.html  ($LATEST_DATE)"
  pandoc "$SCRIPT_DIR/md/$LATEST_DATE.md" \
    --template="$SCRIPT_DIR/templates/briefing.html" \
    --variable="root:" \
    --variable="date:$LATEST_FORMATTED" \
    --variable="isodate:$LATEST_DATE" \
    --to=html5 \
    --output="$SCRIPT_DIR/index.html"
fi

# ── Generate archive.html ─────────────────────────────────────────────────────

echo "→ archive.html"

{
cat <<'HTMLHEAD'
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Archive — Daily Briefing</title>
<script>(function(){
  var t=localStorage.getItem('theme');
  if(t){document.documentElement.setAttribute('data-theme',t);}
  else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){
    document.documentElement.setAttribute('data-theme','dark');
  }
})();</script>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="page-wrapper">

  <nav class="top-nav">
    <div class="nav-links">
      <a href="index.html">Latest</a>
      <a href="search.html">Search</a>
    </div>
    <button id="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">
      <span class="show-light">◐ Dark</span>
      <span class="show-dark">◑ Light</span>
    </button>
  </nav>

  <header class="masthead">
    <div class="masthead-rules-top"></div>
    <h1 class="masthead-title">Daily Briefing</h1>
    <p class="masthead-date">Archive</p>
    <div class="masthead-rule-bottom"></div>
  </header>

  <main class="content">
    <ul class="archive-list">
HTMLHEAD

# List briefings newest-first
while IFS= read -r d; do
  formatted="$(format_date "$d")"
  echo "      <li><a href=\"briefings/$d.html\"><span class=\"entry-title\">$formatted</span></a></li>"
done < <(
  ls "$SCRIPT_DIR/briefings/" 2>/dev/null \
    | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.html$' \
    | sed 's/\.html$//' \
    | sort -r
)

cat <<'HTMLFOOT'
    </ul>
  </main>

  <footer class="site-footer">
    <a href="index.html">← Latest</a>
  </footer>

</div>
<script src="assets/theme.js"></script>
</body>
</html>
HTMLFOOT
} > "$SCRIPT_DIR/archive.html"

# ── Generate search index ────────────────────────────────────────────────────

echo "→ assets/search-index.json"

{
echo "["
FIRST=true
for mdfile in "$SCRIPT_DIR"/md/*.md; do
  [[ -f "$mdfile" ]] || continue
  d="$(basename "$mdfile" .md)"
  [[ "$d" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || continue

  # Read file content and JSON-escape it
  TEXT="$(cat "$mdfile" | \
    sed 's/^#\+[[:space:]]*//' | \
    tr '\n' ' ' | \
    sed 's/  */ /g' | \
    sed 's/\\/\\\\/g' | \
    sed 's/"/\\"/g' | \
    sed 's/	/ /g')"

  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    echo ","
  fi
  printf '  {"date":"%s","text":"%s"}' "$d" "$TEXT"
done
echo ""
echo "]"
} > "$SCRIPT_DIR/assets/search-index.json"

# ── Git commit & push ─────────────────────────────────────────────────────────

cd "$SCRIPT_DIR"

git add \
  "md/$DATE.md" \
  "briefings/$DATE.html" \
  "index.html" \
  "archive.html" \
  "search.html" \
  "assets/search-index.json"

MSG="${COMMIT_MSG:-"Add briefing: $DATE_FORMATTED"}"
git commit -m "$MSG"

echo "→ Pushing to remote..."
git push

echo ""
echo "✓ Published: $DATE_FORMATTED"
echo "  Briefing:  briefings/$DATE.html"
echo "  Live at:   https://evanblake17.github.io/icfi-briefing-site/"
