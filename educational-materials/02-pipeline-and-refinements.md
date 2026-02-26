# What We Built Next: Pipeline Automation, Translation, and Refinements

*Last updated: February 26, 2026*
*Covers: Everything after the initial architecture overview (Feb 25 evening through Feb 26)*

---

## What Changed Since the First Document

The first document (`01-architecture-overview.md`) covered the core site: HTML/CSS/JS, Pandoc, GitHub Pages, Supabase auth, and the major UX features (highlighting, notes, focus mode, bookmarks, etc.). Since then, we:

1. Built a **German translation pipeline** with a language selector
2. Redesigned the **masthead** and created an **OG image** for social media previews
3. Created **standalone agent definitions** so the morning pipeline can run unattended
4. Developed an **editorial format guide** that governs what the AI agents produce
5. Fixed a series of **platform-specific bugs** in the pipeline scripts
6. Fixed a **browser selection bug** caused by HTML element choice
7. Created a **`/save-decisions` slash command** to persist design decisions across sessions

Here's how each piece works and why we made the choices we did.

---

## The German Translation Pipeline

### The Problem

The briefing is written in English, but some readers need it in German. Translating ~8,000 words of political journalism daily by hand isn't practical. We needed an automated solution.

### How It Works

A new Bash script — `translate-briefing.sh` (179 lines) — takes an English briefing and produces a German version:

```
English briefing (Markdown)
     ↓
translate-briefing.sh calls the Claude CLI
     ↓
Claude Sonnet translates the full document
     ↓
German briefing saved as YYYY-MM-DD_full_de.md
     ↓
publish.sh detects the German file and generates briefings/de/YYYY-MM-DD.html
```

The script passes the entire English briefing to Claude with a detailed prompt specifying rules like: translate all prose, keep HTML markup untouched, keep URLs unchanged, keep publication names in their original language, use formal German (Sie), and translate specific section headings (e.g., "What we're covering today" becomes "Was wir heute behandeln").

### Key Design Decisions

**Why Claude Sonnet for translation (not Opus)?** Sonnet is faster and cheaper. Translation doesn't require the deep analytical reasoning that Opus excels at — it's a well-defined transformation task. Sonnet handles it reliably, and at ~35,000 tokens per translation, the cost savings add up over daily use.

**Why `--output-format json`?** The Claude CLI can return its response as structured JSON, which includes a `usage` field with token counts. This lets us track exactly how many tokens each translation costs. The script parses this with a small Python snippet and appends it to a daily token report.

**Why `--max-turns 1`?** Translation is a single-shot task — give the model the text, get the translation back. There's no need for the model to use tools or have multiple turns of reasoning. Limiting to one turn prevents unexpected behavior and makes the script predictable.

**Why `--dangerously-skip-permissions`?** When running automated in a cron/launchd context, there's no human at the keyboard to click "approve" on permission prompts. This flag tells the CLI to skip those prompts. The name is intentionally scary — it's a reminder that you're removing a safety guardrail, which is appropriate only for trusted, well-defined automation scripts.

### The Language Selector

A new JavaScript file — `lang.js` (261 lines) — adds a dropdown in the navigation bar that lets readers switch between English (EN) and German (DE).

When you select German:
1. The selector saves your preference to `localStorage` (so it remembers next time)
2. It translates all **static UI elements** — navigation labels, button text, the masthead, auth screen text, archive month names, weekday names
3. It **redirects** to the German version of the current briefing (e.g., `/briefings/2026-02-26.html` → `/briefings/de/2026-02-26.html`)

**Why a dropdown, not a button?** A dropdown scales to more languages if needed later. Adding a third language (French, Spanish, etc.) would require only adding entries to the `LANGUAGES` object and `TRANSLATIONS` dictionary — no UI changes.

**Why translate UI elements client-side?** The briefing *content* is pre-translated by the translation script (different Markdown files for each language). But the *chrome* around the content — nav links, buttons, the auth screen — is baked into the HTML templates and shared across all briefings. Translating that in JavaScript means we don't need separate templates per language. One template serves all languages; `lang.js` patches the UI labels at load time.

**The redirect approach:** When you switch to German, the browser navigates to the `/de/` version of the briefing if it exists. If it doesn't (perhaps translation hasn't run yet), it falls back to reloading the current page with translated UI labels. This graceful degradation means the language selector never breaks, even if a German translation hasn't been generated for a particular day.

---

## The Masthead Redesign and OG Image

### OG Image — What and Why

**OG (Open Graph) image** is the preview image that appears when you share a link on social media, Slack, iMessage, etc. Without one, shared links show a generic placeholder or nothing. We created a branded 1200x630 pixel image (`assets/og-image.png`) that displays the site's name and tagline.

The HTML template includes `<meta>` tags that tell social platforms where to find this image:

```html
<meta property="og:image" content="https://evanblake17.github.io/icfi-briefing-site/assets/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
```

When someone pastes a briefing URL into Slack or Twitter, the platform reads these tags and displays the image. It's a small detail, but it makes shared links look professional rather than bare.

### Masthead Redesign

The original masthead was simple text. We redesigned it to match the visual style of the OG image — a "D3 hero block" design with:

- A colored accent bar at the top
- The title "Morning Briefing" in a serif font
- The date beneath it
- A divider line
- A tagline: "World Events · Class Struggle · Strategic Insights · Daily"
- A reading time estimate (calculated by `app.js` based on word count)

The masthead uses CSS custom properties that change with the theme, so it looks correct in both light and dark mode.

---

## Standalone Agent Definitions

### The Problem

In the first version, the AI pipeline only worked when run interactively inside a Claude Code session — you'd type a command, and the agent would run in the context of that conversation. But for a 6 AM automated pipeline, there's no conversation. The agents need to work autonomously.

### The Solution

We created two standalone agent definition files in `.claude/agents/`:

**`briefing-research.md`** (82 lines) — Defines the research agent's role, workflow, output format, and critical rules. Key sections:

- **Workflow:** Search bourgeois press first (Reuters, AP, BBC, etc.) to establish what's objectively important, then search WSWS, then science/health, then identify coverage gaps
- **Output format:** A structured Markdown template with sections for bourgeois press stories, WSWS articles, science/health, and coverage suggestions — each with full URLs, publication names, and summaries
- **Critical rules:** Gather bourgeois press first, preserve full URLs, include at least 5 coverage gap suggestions

**`briefing-writer.md`** (45 lines) — Defines the writer agent's role. Key sections:

- **Workflow:** Read the raw material, read the format guide, write the final briefing
- **Key requirements:** Summary section, sentence case headings, source links, editorial policy compliance
- **Editorial policy:** Top stories need bourgeois press sources; WSWS-only stories go in the WSWS section

### Why Separate Files?

These files serve two purposes:

1. **For Claude Code:** When the Task tool launches a subagent with `subagent_type: "briefing-research"`, it reads the corresponding `.claude/agents/briefing-research.md` file as the agent's instructions. This is how Claude Code's agent system works — the filename maps to the agent type.

2. **For humans:** Anyone reading these files can understand exactly what each agent does, what rules it follows, and what output to expect. They serve as documentation and specification simultaneously.

The alternative — embedding instructions in a Bash script or a prompt string — would be fragile, hard to read, and impossible to iterate on independently of the pipeline code.

---

## The Editorial Format Guide

### What It Is

`briefing/briefing-format.md` (278 lines) is the single source of truth for how a briefing should be structured. The writer agent reads this file before writing every briefing. It specifies:

1. **Top summary section:** "What we're covering today" — 4-8 bullet points
2. **Heading case:** Sentence case only (capitalize first word and proper nouns)
3. **Source links:** HTML format with `target="_blank" rel="noopener"`, publication names in bold
4. **Editorial policy:** Applies to ALL news sections — stories selected by real-world significance, not WSWS coverage
5. **Science section:** ~500 words covering major studies, disease data, tech developments
6. **Coverage suggestions:** "What the WSWS should cover today" — at least 5 prioritized items
7. **Overall structure:** The exact section ordering and heading names
8. **Research agent requirements:** Preserve full source URLs for every article

### The Editorial Policy — Why It Matters

This was the most significant editorial decision. The briefing has two kinds of content:

- **News sections** (Top Stories, International, US, Science/Health): Should cover the objectively most important events of the day, as determined by what major news organizations are reporting
- **WSWS section:** Summarizes what the WSWS published, which is editorially independent from mainstream coverage

The policy ensures news sections don't become an echo chamber of WSWS coverage. If the WSWS wrote about a topic that's also a major news story (e.g., a labor strike covered by AP and the WSWS), the briefing includes both sources and weaves in the WSWS analysis. But if the WSWS wrote about something that no mainstream outlet covered, that story belongs in the WSWS section only.

**Why this rule?** Without it, the writer agent naturally gravitates toward topics where it has the richest source material — which is often WSWS articles, because they're long, analytical, and information-dense. This led to news sections that looked like a curated list of "things the WSWS wrote about" rather than a genuine overview of the day's most important events. The policy corrects this by requiring at least one bourgeois press source for every story in a news section.

### Why a Separate File (Not Embedded in the Agent Definition)?

The format guide changes more often than the agent definitions. Editorial rules evolve as we read actual briefings and notice problems (like the US section echoing WSWS topics). Keeping the guide in its own file means we can update formatting rules without touching the agent definitions, and vice versa. The writer agent reads the guide fresh every morning, so changes take effect immediately.

---

## Pipeline Bug Fixes — A Debugging Story

Running an automated pipeline across different tools, platforms, and environments surfaced several bugs. Each one illustrates a common category of software problem.

### Bug 1: "CLAUDECODE: unbound variable"

**What happened:** `translate-briefing.sh` crashed immediately with an error about an unbound variable.

**Why:** The script has `set -euo pipefail` at the top. The `-u` flag means "treat any reference to an undefined variable as an error." When the script is run from *inside* a Claude Code session, Claude Code sets an environment variable called `CLAUDECODE`. But when you then try to run the `claude` CLI (to do translation), the CLI detects that `CLAUDECODE` is set and refuses to run — it thinks it's already inside a Claude Code session and doesn't want to nest.

**The fix:** Add `unset CLAUDECODE 2>/dev/null || true` near the top of the script. This removes the variable so the CLI doesn't detect a parent session. The `2>/dev/null || true` part suppresses any error if the variable wasn't set in the first place (which would otherwise trigger the `-u` protection).

**The lesson:** When one tool launches another tool, environment variables can leak between them in unexpected ways. This is a common source of bugs in automation scripts — the environment that works interactively isn't the same as the automated environment.

### Bug 2: "mkstemp failed on /tmp/briefing-XXXXXX.md"

**What happened:** `publish.sh` crashed on macOS when trying to create a temporary file.

**Why:** The `mktemp` command creates a temporary file with a unique name. You provide a template with `XXXXXX` (six X's) that get replaced with random characters. On Linux, `mktemp /tmp/briefing-XXXXXX.md` works fine — the `.md` suffix is kept. But on macOS (which uses BSD `mktemp`), the X pattern **must be at the very end** of the template. Anything after the X's causes it to fail.

**The fix:** Changed `mktemp /tmp/briefing-XXXXXX.md` to `mktemp /tmp/briefing-XXXXXX` (no `.md` suffix). The temp file doesn't need an extension — it's an intermediate file that gets deleted after use.

**The lesson:** macOS and Linux look similar (both are Unix-like) but have subtle differences in command behavior. BSD utilities (macOS) and GNU utilities (Linux) often have different flag interpretations and edge cases. This is a classic cross-platform portability issue.

### Bug 3: Translation Preamble

**What happened:** The German translation included 17 lines of the model's own instructions translated into German ("KRITISCHE REGELN:...") before the actual briefing content.

**Why:** The translation prompt included detailed rules ("CRITICAL RULES: 1. Translate ALL prose text..."). The model, asked to translate everything, helpfully translated its own instructions too, then included the actual briefing.

**The fix:** Strip the first 17 lines of output with `tail -n +18`. This is a pragmatic fix — it works reliably because the preamble is consistent in length.

**The lesson:** Language models follow instructions literally. Telling it to "translate ALL prose text" meant it translated *all* text it could see, including the instructions themselves. More precise prompting (or post-processing) is needed when the prompt itself contains translatable text.

### Bug 4: SOTU Date Error

**What happened:** The briefing's first sentence said Trump delivered his SOTU "on the evening of February 25," but it was actually February 24.

**Why:** The research agent gathered a BBC fact-check article published at 10:40 AM UTC on February 25. The writer agent, seeing a Feb 25 publication date, assumed the speech was that evening. But the BBC article was published the *morning after* the speech — a common pattern for fact-check pieces that require time to research and write.

**How we verified:** February 24 is a Tuesday, the traditional day for State of the Union addresses. The BBC article's 10:40 AM UTC timestamp (5:40 AM EST) proves it was published *before* any evening event on Feb 25. The speech had to have been the night before.

**The fix:** Changed "February 25" to "February 24" in both the English and German briefings, regenerated HTML, and pushed.

**The lesson:** AI agents can make logical inference errors when publication timestamps don't clearly indicate when an *event* occurred versus when it was *reported on*. Date verification should be a step in the quality assurance process.

---

## The Triple-Click Selection Bug

### What the User Reported

"When you triple-click and highlight a full paragraph, it highlights everything below the paragraph selected too. Doesn't happen if you click-drag to select the full paragraph, only when triple-clicking."

### What Triple-Click Does

In web browsers, triple-clicking selects an entire "block" of text. What counts as a "block" depends on the HTML structure. Triple-clicking inside a `<p>` (paragraph) element should select just that paragraph. But the browser's definition of "block" can vary depending on the parent element.

### The Investigation

We checked everything:
- **CSS properties** like `user-select`, `display`, `column-count` — all normal
- **JavaScript event handlers** — the highlight tooltip reads the selection but doesn't modify it
- **DOM structure** — paragraphs were properly wrapped in `<p>` elements
- **Whitespace text nodes** — 44 whitespace nodes existed between elements, but none contained real content

### The Root Cause

The `wrapSections()` function in `app.js` was creating `<section>` elements to wrap groups of content between horizontal rules. WebKit (the browser engine behind Chrome and Safari) treats `<section>` as a **sectioning content** element in the HTML5 outline algorithm. When you triple-click inside a `<section>`, some browsers extend the selection to include the entire section's content rather than just the individual paragraph.

This is a subtle browser behavior difference — `<section>` is semantically meaningful to the browser in ways that affect text selection, while `<div>` is semantically neutral.

### The Fix (Two Parts)

**1. Changed `<section>` to `<div>` in app.js:**

```javascript
// Before:
var section = document.createElement('section');

// After:
var section = document.createElement('div');
```

`<div>` is a generic container with no semantic meaning. The browser treats it as a simple grouping element and doesn't extend triple-click selection beyond paragraph boundaries within it.

**2. Added `contain: content` to the CSS:**

```css
.briefing-section {
  padding: 0 28px;
  margin: 0 -28px;
  transition: opacity 0.35s ease;
  contain: content;   /* ← new */
}
```

`contain: content` is a CSS property that tells the browser: "This element is an independent formatting context. Nothing inside it affects anything outside, and vice versa." This creates a hard boundary for text selection — even if the browser's selection algorithm tries to extend beyond a paragraph, it can't cross the `contain` boundary.

### Why Both Changes?

Belt and suspenders. The `<div>` change fixes the immediate problem (WebKit's `<section>` behavior). The `contain: content` adds a CSS-level guarantee that selection stays within bounds regardless of future HTML changes. Either fix alone would likely work; together, they're robust.

**What didn't break:** Focus mode (which dims other sections using `opacity` transitions) and alternating background bands (which alternate gray/white backgrounds) both continued working perfectly with `<div>` elements. These features use the `.briefing-section` CSS class, which doesn't care whether the underlying element is a `<section>` or `<div>`.

---

## The `/save-decisions` Slash Command

### The Problem

Claude Code sessions have a finite context window (~200,000 tokens). When a session gets long, older messages are compressed into summaries to make room. This compression is lossy — details get dropped, especially design discussions and "let's do X next time" plans that weren't immediately acted on.

We lost a planned "pseudo-left section" discussion to context compaction. It was discussed, agreed upon, but never written to a file — so when the context was compressed, the decision vanished.

### The Solution

A slash command at `.claude/commands/save-decisions.md` that you can run at any point during a session by typing `/save-decisions`. When invoked, Claude:

1. Reviews the current conversation for any undocumented decisions, editorial policies, or plans
2. Checks what's already documented in the format guide, agent definitions, and memory file
3. Writes anything new to the appropriate file
4. Confirms what was saved and where

### Why This Approach?

The root issue is that **conversation context is ephemeral, but files are permanent.** Decisions discussed in conversation evaporate when the context window compresses. Decisions written to files persist forever — across sessions, across compactions, across days.

The slash command is a manual trigger rather than automatic because:
- There's no hook for "context is about to compress" — Claude Code doesn't expose that event
- Automatically saving everything would create noise — not every conversational aside needs to be persisted
- A manual trigger lets you choose *when* to snapshot, typically before ending a session or when it's getting long

### The Memory File

Persistent memory lives at `.claude/projects/.../memory/MEMORY.md`. Claude reads this file at the start of every session in this project. It contains:
- Pending design decisions (like the pseudo-left section)
- Pipeline architecture notes
- Editorial policy summaries
- Key file paths

Think of it as a sticky note that Claude sees every morning. If something important was discussed but not yet implemented, it goes here so it isn't forgotten.

---

## How publish.sh Handles German Translations

The publish script was extended to automatically detect and process German translations:

```bash
DE_MDFILE="$BRIEFING_DIR/${DATE}_full_de.md"

if [[ -f "$DE_MDFILE" ]]; then
  # Convert German Markdown → HTML using same template
  pandoc "$DE_TMPFILE" \
    --template="templates/briefing.html" \
    --variable="lang:de" \
    --output="briefings/de/$DATE.html"
fi
```

**Key detail — the `lang:de` variable:** This tells the HTML template to set `<html lang="de">`, which affects browser behavior (hyphenation, spell-check language, screen reader pronunciation). The same HTML template serves both languages — only the content and the `lang` attribute differ.

**Directory structure:**
```
briefings/
  2026-02-26.html          ← English
  de/
    2026-02-26.html        ← German
```

The Git commit automatically includes German files if they exist, so a single `publish.sh` run handles both languages.

---

## What the Codebase Looks Like Now

### File Counts (as of Feb 26, 2026)

| File | Lines | Role |
|------|-------|------|
| `assets/app.js` | 1,379 | Main interactivity engine |
| `assets/style.css` | 1,931 | All styling and theming |
| `assets/lang.js` | 261 | Language selector and UI translation |
| `assets/auth.js` | ~303 | Supabase authentication |
| `publish.sh` | 414 | Markdown → HTML → Git → deploy |
| `translate-briefing.sh` | 179 | English → German translation |
| `briefing/briefing-format.md` | 278 | Editorial format guide |
| `.claude/agents/briefing-research.md` | 82 | Research agent definition |
| `.claude/agents/briefing-writer.md` | 45 | Writer agent definition |
| `.claude/commands/save-decisions.md` | 14 | Decision persistence command |

### The Complete Morning Pipeline

```
6:00 AM (launchd trigger):

  1. Research Agent (Claude Sonnet, ~20 min, ~100K tokens)
     → Searches BBC, AP, Al Jazeera, DW, The Lancet, WSWS
     → Outputs: briefing/daily/YYYY-MM-DD_raw.md

  2. Writer Agent (Claude Opus, ~20 min, ~105K tokens)
     → Reads raw material + briefing-format.md
     → Outputs: briefing/daily/YYYY-MM-DD_full.md

  3. translate-briefing.sh (Claude Sonnet, ~5 min, ~35K tokens)
     → Translates English briefing to German
     → Outputs: briefing/daily/YYYY-MM-DD_full_de.md

  4. publish.sh (~30 sec)
     → Pandoc: Markdown → HTML (both languages)
     → Generates: index.html, archive.html, search index
     → Git commit + push to GitHub Pages

Total: ~240K tokens, ~48 minutes, fully automated
```

---

## Concepts Introduced in This Round

### Environment Variables

Variables that exist in the "environment" surrounding a running program. When you open Terminal, your shell has dozens of them (try `env` to see). Programs inherit their parent's environment variables. This is how `CLAUDECODE` leaked from the Claude Code session into `translate-briefing.sh` — the script inherited the variable from the session that launched it.

### `set -euo pipefail`

A common safety preamble for Bash scripts:
- `-e`: Exit immediately if any command fails (don't silently continue)
- `-u`: Treat references to undefined variables as errors
- `-o pipefail`: If any command in a pipeline fails, the whole pipeline fails

Without these flags, Bash will happily ignore errors and continue executing, which can lead to scripts that appear to succeed but produce wrong or incomplete results. It's a best practice for any script that matters.

### CSS `contain: content`

A performance and layout isolation property. It tells the browser: "This element is self-contained — its internal layout doesn't affect the rest of the page, and vice versa." Browsers can use this hint to optimize rendering (they know changes inside the container can't ripple outward). In our case, we used it primarily for its side effect of creating a hard selection boundary.

### `mktemp` and Temporary Files

`mktemp` creates a file with a random name in a temporary directory, guaranteed not to collide with existing files. This is important when scripts run concurrently — if two copies of `publish.sh` ran at the same time, they need different temp files. The `XXXXXX` pattern gets replaced with random characters (e.g., `/tmp/briefing-a8f3k2`).

### Token Tracking

Language models charge by **tokens** — roughly word-fragments that the model processes. A word like "understanding" might be 2-3 tokens. Tracking token usage tells you the cost of each pipeline step. Our daily pipeline uses ~240,000 tokens: ~100K for research, ~105K for writing, ~35K for translation.

### Slash Commands in Claude Code

Files in `.claude/commands/` become available as `/command-name` in Claude Code sessions. The file content becomes the prompt that runs when you invoke the command. It's a way to create reusable, named operations — like macros or keyboard shortcuts for AI interactions.

---

## Change Log

| Date | Changes |
|------|---------|
| Feb 26, 2026 | Initial document covering German translation pipeline, masthead redesign, OG image, agent definitions, format guide, editorial policy, pipeline bug fixes (CLAUDECODE, mktemp, preamble, SOTU date), triple-click selection fix, /save-decisions command |
