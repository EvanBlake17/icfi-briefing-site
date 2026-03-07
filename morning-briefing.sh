#!/usr/bin/env bash
# morning-briefing.sh — Automated daily briefing pipeline
#
# Runs three steps in sequence:
#   1. Parallel research  → 6 focused claude -p calls gather material concurrently
#   2. briefing-writer agent → synthesizes the final briefing
#   3. publish.sh            → converts to HTML and pushes to GitHub Pages
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
  local exit_code=0
  wait "$cmd_pid" 2>/dev/null || exit_code=$?
  kill "$watchdog_pid" 2>/dev/null || true
  wait "$watchdog_pid" 2>/dev/null || true
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


# ── Step 1: Parallel research ────────────────────────────────────────────────
#
# Instead of one monolithic research agent (which kept stalling after writing
# only a skeleton file), we run multiple focused claude -p calls in parallel.
# Each gathers one section of the raw material. The shell script stitches them.
#
# This is more reliable because:
#   - Each call is simple and focused (3-10 max turns vs 80)
#   - If one section fails, the others still succeed
#   - No complex checkpoint system — each call outputs directly to stdout
#   - Shell handles orchestration (the reliable part)
#   - Total time: ~5-10 min instead of 60-90 min

log "Step 1/3: Gathering research material (parallel sub-steps)..."
STEP1_START=$(date +%s)

RESEARCH_TMP=$(mktemp -d /tmp/briefing-research-XXXXXXXX)
RAW_FILE="$WORK_DIR/briefing/daily/${DATE}_raw.md"

# ── 1a: Prior briefing context (shell only, no Claude) ──────────────────────

log "  1a: Extracting prior briefing context..."
{
  echo "# Briefing Raw Material — $DATE_HUMAN"
  echo ""
  echo "## Prior Briefing Summary"
  echo ""
  for f in $(ls -t "$WORK_DIR/briefing/daily/"*_full.md 2>/dev/null | grep -v "$DATE" | head -3); do
    briefing_date=$(basename "$f" | sed 's/_full\.md//')
    stories=$(head -40 "$f" | grep '^### ' | sed 's/^### [0-9]*\. /- /' | head -6)
    if [[ -n "$stories" ]]; then
      echo "**$briefing_date:**"
      echo "$stories"
      echo ""
    fi
  done
} > "$RESEARCH_TMP/00-header.md"
log "  1a: Done"

# ── Helper: launch a focused research call ───────────────────────────────────

_RESEARCH_PID=0   # global — set by research_call, read by caller

research_call() {
  local name="$1" max_turns="$2" outfile="$3"
  shift 3
  local prompt="$*"

  log "  $name: Starting..."
  # Run from /tmp to avoid loading project CLAUDE.md and agents (saves tokens).
  # IMPORTANT: Do NOT call this function inside $() — background processes
  # launched in a $() subshell become orphans that the main shell cannot wait on.
  # Instead, read the PID from the global _RESEARCH_PID after calling.
  ( cd /tmp && "$CLAUDE" -p "$prompt" \
      --max-turns "$max_turns" \
      --model sonnet \
      --no-session-persistence \
      --dangerously-skip-permissions \
  ) > "$outfile" 2>> "$LOGFILE" &
  _RESEARCH_PID=$!
}

# ── 1b: Top news stories ────────────────────────────────────────────────────

research_call "1b-news" 10 "$RESEARCH_TMP/01-news.md" \
"Today is $DATE_HUMAN. Search for the 8-10 most significant world news stories from the past 24 hours. Use WebSearch to find stories, then use WebFetch on the 2-3 most important articles for detail.

For each story, output in this exact format:

### [Number]. [Headline in sentence case]
- **Sources:** [Publication Name](URL), [Publication Name](URL)
- **Key facts:** [3-5 bullet points with specific data: death tolls, vote counts, percentages, direct quotes from officials with attribution]
- **WSWS overlap:** [Yes/No — note if WSWS likely covered this topic]

Focus on: wars/conflicts, major political developments, economic crises, international diplomacy, significant US domestic events. Prioritize by objective world significance — not US-centric. Include full source URLs for every story. ALL sources must be from the past 48 hours.

Also identify 5+ significant stories a socialist publication should cover. For each gap:
### Gap [Number]: [Potential headline]
- **Description:** [2-3 sentences on the event]
- **Best source:** [Publication — Article headline](URL)

Print your entire response directly — do NOT use the Write tool or write any files."
PID_NEWS=$_RESEARCH_PID

# ── 1c: WSWS articles ───────────────────────────────────────────────────────

research_call "1c-wsws" 10 "$RESEARCH_TMP/02-wsws.md" \
"Today is $DATE_HUMAN. Gather all WSWS articles published today.

STEP 1: Fetch https://www.wsws.org/en/topics/site_area/perspectives to find today's Perspective. The Perspective MUST be dated today ($DATE). Verify the article URL contains /$DATE/ (with slashes replaced as in the URL pattern). If no Perspective was published today, note this explicitly.

STEP 2: Fetch https://www.wsws.org/en/archive/recent to list ALL articles published today ($DATE) or yesterday.

For the Perspective, fetch the full article and write a detailed summary:
### Editorial/Perspective: \"[Title]\" — [Author]
- URL: [full URL]
- Date: [confirm today's date]
[600-800 word summary: all major arguments, key quotations with attribution, data points, political conclusions]
- Overlaps with bourgeois press: [Yes — which topic / No]

For each other article:
### [Title] — [Author]
- URL: [full URL]
- Type: [news/polemic/letters/obituary/This Week in History]
- Summary: [2-3 sentences: main argument, key data, political conclusion]
- Overlaps with bourgeois press: [Yes — which / No]

Print your entire response directly — do NOT use the Write tool or write any files."
PID_WSWS=$_RESEARCH_PID

# ── 1d: Science and health ──────────────────────────────────────────────────

research_call "1d-science" 5 "$RESEARCH_TMP/03-science.md" \
"Today is $DATE_HUMAN. Search for science, technology, and public health news from the past 48 hours. Check for:
- US measles cases (latest CDC data from cdc.gov/measles/data-research/)
- H5N1 bird flu updates
- COVID-19 data if significant
- Major studies in Nature, Science, Lancet, NEJM, JAMA
- Significant tech/AI policy developments

For each item:
### [Headline]
- **Source:** [Publication](URL)
- **Key finding:** [1-2 sentences with specific numbers]
- **Significance:** [1 sentence]

Include at least 3-5 items with full URLs. Print directly — do NOT write files."
PID_SCIENCE=$_RESEARCH_PID

# ── 1e: World economy and markets ───────────────────────────────────────────

research_call "1e-economy" 5 "$RESEARCH_TMP/04-economy.md" \
"Today is $DATE_HUMAN. Get the latest market data and economic news. I need specific numbers:

### Markets (most recent close)
- Dow Jones: [points] [+/- points] ([% change])
- S&P 500: [points] [+/- points] ([% change])
- Nasdaq: [points] [+/- points] ([% change])
- Key European indices (FTSE, DAX): [% changes]
- Key Asian indices (Nikkei, Shanghai, Hang Seng, KOSPI): [% changes and key drivers]

### Commodities
- Oil WTI: \$[price]/bbl [+/- %]
- Oil Brent: \$[price]/bbl [+/- %]
- Gold: \$[price]/oz [+/- %]

### Crypto
- Bitcoin: \$[price] [+/- %]
- Ethereum: \$[price] [+/- %]

### Economic data releases (past 24 hours)
[Any GDP, jobs, inflation, PMI, central bank decisions with specific numbers]

### Corporate/trade developments
[Major bankruptcies, M&A, tariffs, sanctions]

Include source URLs. Print directly — do NOT write files."
PID_ECONOMY=$_RESEARCH_PID

# ── 1f: Pseudo-left press ───────────────────────────────────────────────────

research_call "1f-pseudoleft" 5 "$RESEARCH_TMP/05-pseudoleft.md" \
"Today is $DATE_HUMAN. Scan these pseudo-left publications for their 2-3 most notable articles from the past 24 hours. Scan headlines and opening paragraphs only — do not read in depth.

Check: Jacobin (jacobin.com), Left Voice (leftvoice.org), Liberation News/PSL (liberationnews.org), Socialist Alternative (socialistalternative.org), SWP UK (socialistworker.co.uk), Socialist Appeal/RCP (socialist.net or communist.red)

For each tendency:
### [Tendency name]
- **\"[Article title]\"** — [URL]
  - Political line: [1-2 sentence summary of the argument and its class orientation]
- **\"[Article title]\"** — [URL]
  - Political line: [1-2 sentence summary]

Note any: support for bourgeois parties, channeling opposition through Democrats/Labour, failure to oppose imperialist war, national-reformist programs, attacks on Trotskyism/ICFI.

Print directly — do NOT write files."
PID_PSEUDO=$_RESEARCH_PID

# ── 1g: Arts and culture ────────────────────────────────────────────────────

research_call "1g-arts" 3 "$RESEARCH_TMP/06-arts.md" \
"Today is $DATE_HUMAN. Search for major arts, culture, film, theater, and music news from the past 24 hours. Look for:
- Major film releases or festival news
- Notable book publications or literary awards
- Significant theater/opera developments
- Deaths of cultural figures
- Censorship or defunding of arts institutions
- Cultural developments connected to war or political repression

Output 3-6 items:
### [Headline]
- **Source:** [Publication](URL)
- **Summary:** [1-2 sentences]
- **Significance:** [1 sentence]

Print directly — do NOT write files."
PID_ARTS=$_RESEARCH_PID

# ── Wait for all sub-steps ───────────────────────────────────────────────────

ALL_PIDS="$PID_NEWS $PID_WSWS $PID_SCIENCE $PID_ECONOMY $PID_PSEUDO $PID_ARTS"

# Global 10-minute timeout — kill anything still running
( sleep 600
  for pid in $ALL_PIDS; do
    if kill -0 "$pid" 2>/dev/null; then
      log "WARNING: Research PID $pid timed out after 10 min — killing"
      kill "$pid" 2>/dev/null
      sleep 3
      kill -9 "$pid" 2>/dev/null
    fi
  done
) &
RESEARCH_WATCHDOG=$!

wait_step() {
  local pid="$1" name="$2" outfile="$3"
  # Use || true to prevent set -e from killing the script when the background
  # process exits non-zero.  Capture the real exit code via $? afterward.
  local exit_code=0
  wait "$pid" 2>/dev/null || exit_code=$?
  local lines=0
  [[ -f "$outfile" ]] && lines=$(wc -l < "$outfile" | tr -d ' ')
  if [[ $exit_code -eq 0 && $lines -gt 3 ]]; then
    log "  $name: OK ($lines lines)"
  elif [[ $lines -gt 3 ]]; then
    log "  $name: Warning — exit code $exit_code but has output ($lines lines), using it"
  else
    log "  $name: FAILED (exit $exit_code, $lines lines)"
  fi
}

wait_step "$PID_NEWS"    "1b-news"       "$RESEARCH_TMP/01-news.md"
wait_step "$PID_WSWS"    "1c-wsws"       "$RESEARCH_TMP/02-wsws.md"
wait_step "$PID_SCIENCE" "1d-science"    "$RESEARCH_TMP/03-science.md"
wait_step "$PID_ECONOMY" "1e-economy"    "$RESEARCH_TMP/04-economy.md"
wait_step "$PID_PSEUDO"  "1f-pseudoleft" "$RESEARCH_TMP/05-pseudoleft.md"
wait_step "$PID_ARTS"    "1g-arts"       "$RESEARCH_TMP/06-arts.md"

kill "$RESEARCH_WATCHDOG" 2>/dev/null || true
wait "$RESEARCH_WATCHDOG" 2>/dev/null || true

# ── Validate critical sections ───────────────────────────────────────────────

NEWS_LINES=0; [[ -f "$RESEARCH_TMP/01-news.md" ]] && NEWS_LINES=$(wc -l < "$RESEARCH_TMP/01-news.md" | tr -d ' ')
WSWS_LINES=0; [[ -f "$RESEARCH_TMP/02-wsws.md" ]] && WSWS_LINES=$(wc -l < "$RESEARCH_TMP/02-wsws.md" | tr -d ' ')

if [[ "$NEWS_LINES" -lt 5 && "$WSWS_LINES" -lt 5 ]]; then
  notify "Research failed — both news and WSWS empty. Manual intervention needed."
  die "Critical research steps failed — both news ($NEWS_LINES lines) and WSWS ($WSWS_LINES lines) sections empty"
fi

# ── Stitch sections into raw file ────────────────────────────────────────────

log "  Stitching raw file..."
{
  cat "$RESEARCH_TMP/00-header.md"

  echo ""
  echo "---"
  echo ""
  echo "## Bourgeois Press — Top Stories (by objective significance)"
  echo ""
  if [[ -s "$RESEARCH_TMP/01-news.md" ]]; then
    cat "$RESEARCH_TMP/01-news.md"
  else
    echo "[Research step failed — no news data gathered]"
  fi

  echo ""
  echo "---"
  echo ""
  echo "## WSWS Articles (past 24 hours)"
  echo ""
  if [[ -s "$RESEARCH_TMP/02-wsws.md" ]]; then
    cat "$RESEARCH_TMP/02-wsws.md"
  else
    echo "[Research step failed — no WSWS data gathered]"
  fi

  echo ""
  echo "---"
  echo ""
  echo "## Science, Technology, and Public Health"
  echo ""
  if [[ -s "$RESEARCH_TMP/03-science.md" ]]; then
    cat "$RESEARCH_TMP/03-science.md"
  else
    echo "[Research step failed — no science data gathered]"
  fi

  echo ""
  echo "---"
  echo ""
  echo "## World Economy Data"
  echo ""
  if [[ -s "$RESEARCH_TMP/04-economy.md" ]]; then
    cat "$RESEARCH_TMP/04-economy.md"
  else
    echo "[Research step failed — no economy data gathered]"
  fi

  echo ""
  echo "---"
  echo ""
  echo "## Pseudo-left Press (past 24 hours)"
  echo ""
  if [[ -s "$RESEARCH_TMP/05-pseudoleft.md" ]]; then
    cat "$RESEARCH_TMP/05-pseudoleft.md"
  else
    echo "[Research step failed — no pseudo-left data gathered]"
  fi

  echo ""
  echo "---"
  echo ""
  echo "## Arts and Culture (past 24 hours)"
  echo ""
  if [[ -s "$RESEARCH_TMP/06-arts.md" ]]; then
    cat "$RESEARCH_TMP/06-arts.md"
  else
    echo "[Research step failed — no arts data gathered]"
  fi

  echo ""
  echo "---"
  echo ""
  echo "## Coverage Gap Suggestions"
  echo ""
  echo "[Coverage gaps are included in the news section above, and will also be identified by the writer agent.]"
} > "$RAW_FILE"

rm -rf "$RESEARCH_TMP"

# ── Measure and report ───────────────────────────────────────────────────────

STEP1_END=$(date +%s)
STEP1_DUR=$((STEP1_END - STEP1_START))

RAW_SIZE="$(wc -c < "$RAW_FILE")"
RAW_LINES="$(wc -l < "$RAW_FILE" | tr -d ' ')"
log "Step 1 complete: ${DATE}_raw.md created (${RAW_SIZE} bytes, ${RAW_LINES} lines, ${STEP1_DUR}s)"

if [[ "$RAW_LINES" -lt 50 ]]; then
  log "WARNING: Raw file has only $RAW_LINES lines — may be incomplete but proceeding"
  notify "Research produced thin raw file ($RAW_LINES lines). Briefing may be incomplete."
fi

record_step "Step 1: Parallel Research (Sonnet)" "$STEP1_DUR" "| Model | Claude Sonnet (6 parallel calls) |
| Output size | ${RAW_SIZE} bytes (${RAW_LINES} lines) |
| News lines | ${NEWS_LINES} |
| WSWS lines | ${WSWS_LINES} |"

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

STEP2_EXIT=0
wait "$STEP2_PID" 2>/dev/null || STEP2_EXIT=$?
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
