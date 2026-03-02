#!/usr/bin/env bash
# publish.sh — Convert a markdown briefing to HTML and publish to GitHub Pages
#
# Usage:
#   ./publish.sh 2026-02-26                    ← looks for briefing/daily/2026-02-26_full.md
#   ./publish.sh path/to/any-file.md           ← explicit path (filename must start with YYYY-MM-DD)
#   ./publish.sh 2026-02-26 "commit message"   ← optional custom commit message
#
# Requirements: pandoc (brew install pandoc)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIEFING_DIR="$HOME/Projects/editorial/briefing/briefing/daily"

# ── Helpers ───────────────────────────────────────────────────────────────────

usage() {
  echo "Usage:"
  echo "  $0 YYYY-MM-DD                  # uses briefing/daily/YYYY-MM-DD_full.md"
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
  tmpfile="$(mktemp /tmp/briefing-XXXXXX)"
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

mkdir -p "$SCRIPT_DIR/briefings" "$SCRIPT_DIR/briefings/de" "$SCRIPT_DIR/md" "$SCRIPT_DIR/md/de"

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

# ── Generate German briefing page (if translation exists) ─────────────────────

DE_MDFILE="$BRIEFING_DIR/${DATE}_full_de.md"
DE_ALT="$BRIEFING_DIR/${DATE}_de.md"

if [[ -f "$DE_MDFILE" || -f "$DE_ALT" ]]; then
  DE_SRC="${DE_MDFILE}"
  [[ -f "$DE_SRC" ]] || DE_SRC="$DE_ALT"

  DE_TMPFILE="$(strip_leading_heading "$DE_SRC")"

  # Save clean German markdown
  cp "$DE_TMPFILE" "$SCRIPT_DIR/md/de/$DATE.md"

  echo "→ briefings/de/$DATE.html"
  pandoc "$DE_TMPFILE" \
    --template="$SCRIPT_DIR/templates/briefing.html" \
    --variable="root:../../" \
    --variable="date:$DATE_FORMATTED" \
    --variable="isodate:$DATE" \
    --variable="lang:de" \
    --to=html5 \
    --output="$SCRIPT_DIR/briefings/de/$DATE.html"

  rm -f "$DE_TMPFILE"
elif [[ -f "$SCRIPT_DIR/md/de/$DATE.md" ]]; then
  # German markdown already in repo (e.g., regeneration)
  echo "→ briefings/de/$DATE.html (from existing md/de/)"
  pandoc "$SCRIPT_DIR/md/de/$DATE.md" \
    --template="$SCRIPT_DIR/templates/briefing.html" \
    --variable="root:../../" \
    --variable="date:$DATE_FORMATTED" \
    --variable="isodate:$DATE" \
    --variable="lang:de" \
    --to=html5 \
    --output="$SCRIPT_DIR/briefings/de/$DATE.html"
fi

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
<title>Archive — Morning Briefing</title>
<script>(function(){
  var t=localStorage.getItem('theme');
  if(t){document.documentElement.setAttribute('data-theme',t);}
  else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){
    document.documentElement.setAttribute('data-theme','dark');
  }
})();</script>
<meta property="og:title" content="Archive — Morning Briefing">
<meta property="og:image" content="https://evanblake17.github.io/icfi-briefing-site/assets/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>

<!-- Auth overlay -->
<div id="auth-overlay">
  <div class="auth-card">
    <h2>Morning Briefing</h2>
    <p class="auth-subtitle">Sign in to continue</p>
    <div id="auth-error"></div>
    <form id="auth-login">
      <div class="auth-field"><label for="login-email">Email</label><input type="email" name="email" id="login-email" required autocomplete="email"></div>
      <div class="auth-field"><label for="login-password">Password</label><input type="password" name="password" id="login-password" required autocomplete="current-password"></div>
      <button type="submit" class="auth-submit" data-label="Sign In">Sign In</button>
      <p class="auth-switch">No account? <a id="show-signup" href="#">Request access</a></p>
    </form>
    <form id="auth-signup" style="display:none">
      <div class="auth-field"><label for="signup-email">Email</label><input type="email" name="email" id="signup-email" required autocomplete="email"></div>
      <div class="auth-field"><label for="signup-password">Password</label><input type="password" name="password" id="signup-password" required autocomplete="new-password" minlength="6"></div>
      <div class="auth-field"><label for="signup-confirm">Confirm Password</label><input type="password" name="confirm" id="signup-confirm" required autocomplete="new-password" minlength="6"></div>
      <button type="submit" class="auth-submit" data-label="Request Access">Request Access</button>
      <p class="auth-switch">Already have an account? <a id="show-login" href="#">Sign in</a></p>
    </form>
    <div id="auth-pending" style="display:none">
      <div class="auth-pending">
        <div class="auth-pending-icon">&#9203;</div>
        <p><strong>Account pending approval.</strong></p>
        <p>Your request has been received. You'll be able to sign in once your account is approved.</p>
      </div>
      <p class="auth-switch"><a id="show-login-pending" href="#">Back to sign in</a></p>
    </div>
  </div>
</div>

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
    <div class="masthead-accent"></div>
    <div class="masthead-inner">
      <h1 class="masthead-title">Morning Briefing</h1>
      <p class="masthead-date">Archive</p>
      <div class="masthead-divider"></div>
      <p class="masthead-tagline">World Events &middot; Class Struggle &middot; Strategic Insights &middot; Daily</p>
    </div>
  </header>

  <main class="content">
    <div class="archive-accordion">
HTMLHEAD

# List briefings newest-first, grouped by Year → Month
PREV_YEAR=""
PREV_MONTH=""
CURRENT_YEAR="$(date +%Y)"
CURRENT_MONTH="$(date +%m)"
MONTH_NAMES=("" "January" "February" "March" "April" "May" "June" "July" "August" "September" "October" "November" "December")

while IFS= read -r d; do
  YEAR="${d:0:4}"
  MONTH="${d:5:2}"
  MONTH_NUM=$((10#$MONTH))
  MONTH_NAME="${MONTH_NAMES[$MONTH_NUM]}"

  # New year group?
  if [[ "$YEAR" != "$PREV_YEAR" ]]; then
    # Close previous month and year if open
    if [[ -n "$PREV_YEAR" ]]; then
      echo "        </ul>"
      echo "      </div>"    # close archive-month
      echo "    </div>"      # close archive-year-body
      echo "  </div>"        # close archive-year
    fi

    # Determine if this year should be expanded (current year = expanded)
    if [[ "$YEAR" == "$CURRENT_YEAR" ]]; then
      YEAR_EXPANDED="true"
    else
      YEAR_EXPANDED="false"
    fi

    echo "  <div class=\"archive-year\">"
    echo "    <button class=\"archive-year-toggle\" aria-expanded=\"$YEAR_EXPANDED\" onclick=\"this.setAttribute('aria-expanded',this.getAttribute('aria-expanded')==='true'?'false':'true')\">"
    echo "      $YEAR <span class=\"toggle-icon\">&#9660;</span>"
    echo "    </button>"
    echo "    <div class=\"archive-year-body\" style=\"max-height:9999px\">"
    PREV_MONTH=""
  fi

  # New month group?
  if [[ "$MONTH" != "$PREV_MONTH" ]]; then
    # Close previous month if open
    if [[ -n "$PREV_MONTH" && "$YEAR" == "$PREV_YEAR" ]]; then
      echo "        </ul>"
      echo "      </div>"    # close archive-month
    fi
    echo "      <div class=\"archive-month\">"
    echo "        <h3 class=\"archive-month-title\">$MONTH_NAME</h3>"
    echo "        <ul class=\"archive-list\">"
  fi

  formatted="$(format_date "$d")"
  # Get weekday name
  if weekday=$(date -j -f "%Y-%m-%d" "$d" "+%A" 2>/dev/null); then
    :
  elif weekday=$(date -d "$d" "+%A" 2>/dev/null); then
    :
  else
    weekday=""
  fi

  echo "          <li><a href=\"briefings/$d.html\"><span class=\"entry-title\">$formatted</span><span class=\"entry-weekday\">$weekday</span></a></li>"

  PREV_YEAR="$YEAR"
  PREV_MONTH="$MONTH"
done < <(
  ls "$SCRIPT_DIR/briefings/" 2>/dev/null \
    | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.html$' \
    | sed 's/\.html$//' \
    | sort -r
)

# Close final month and year
if [[ -n "$PREV_YEAR" ]]; then
  echo "        </ul>"
  echo "      </div>"    # close archive-month
  echo "    </div>"      # close archive-year-body
  echo "  </div>"        # close archive-year
fi

cat <<'HTMLFOOT'
    </div>
  </main>

  <footer class="site-footer">
    <a href="index.html">← Latest</a>
  </footer>

</div>
<script src="assets/theme.js"></script>
<script src="assets/lang.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="assets/config.js"></script>
<script src="assets/auth.js"></script>
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

# Add German files if they exist
if [[ -f "md/de/$DATE.md" ]]; then
  git add "md/de/$DATE.md" "briefings/de/$DATE.html"
fi

MSG="${COMMIT_MSG:-"Add briefing: $DATE_FORMATTED"}"
git commit -m "$MSG"

echo "→ Pushing to remote..."
git push

echo ""
echo "✓ Published: $DATE_FORMATTED"
echo "  Briefing:  briefings/$DATE.html"
echo "  Live at:   https://evanblake17.github.io/icfi-briefing-site/"
