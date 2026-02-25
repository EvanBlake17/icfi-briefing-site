#!/usr/bin/env bash
# publish.sh — Convert a markdown briefing to HTML and publish to GitHub Pages
#
# Usage: ./publish.sh <path/to/YYYY-MM-DD.md> ["optional commit message"]
#
# The markdown file must be named YYYY-MM-DD.md (e.g. 2026-02-25.md).
# The file is copied into md/ in this repo, converted to HTML via pandoc,
# then index.html and archive.html are regenerated and everything is committed.
#
# Requirements: pandoc (brew install pandoc)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Helpers ───────────────────────────────────────────────────────────────────

usage() {
  echo "Usage: $0 <path/to/YYYY-MM-DD.md> [\"commit message\"]"
  echo ""
  echo "  The markdown filename must be in YYYY-MM-DD format."
  echo "  Example: $0 ~/Desktop/2026-02-25.md"
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
  # Fallback
  echo "$d"
}

# ── Validate inputs ───────────────────────────────────────────────────────────

[[ $# -lt 1 ]] && usage

command -v pandoc &>/dev/null || die "pandoc not found. Install with: brew install pandoc"

MDFILE="$1"
COMMIT_MSG="${2:-}"

[[ -f "$MDFILE" ]] || die "File not found: $MDFILE"

BASENAME="$(basename "$MDFILE" .md)"
[[ "$BASENAME" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] \
  || die "Filename must be YYYY-MM-DD.md (got: $(basename "$MDFILE"))"

DATE="$BASENAME"
DATE_FORMATTED="$(format_date "$DATE")"

echo "Publishing briefing: $DATE_FORMATTED"

# ── Setup ─────────────────────────────────────────────────────────────────────

mkdir -p "$SCRIPT_DIR/briefings" "$SCRIPT_DIR/md"

# Copy markdown into the repo for future index.html regeneration
cp "$MDFILE" "$SCRIPT_DIR/md/$DATE.md"

# ── Generate briefing page ────────────────────────────────────────────────────

echo "→ briefings/$DATE.html"

pandoc "$SCRIPT_DIR/md/$DATE.md" \
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

# ── Git commit & push ─────────────────────────────────────────────────────────

cd "$SCRIPT_DIR"

git add \
  "md/$DATE.md" \
  "briefings/$DATE.html" \
  "index.html" \
  "archive.html"

MSG="${COMMIT_MSG:-"Add briefing: $DATE_FORMATTED"}"
git commit -m "$MSG"

echo "→ Pushing to remote..."
git push

echo ""
echo "✓ Published: $DATE_FORMATTED"
echo "  Briefing:  briefings/$DATE.html"
echo "  Homepage:  index.html"
echo "  Archive:   archive.html"
