# Morning Briefing — Production + Publication

This project produces and publishes Evan Blake's daily morning briefing for ICFI/SEP leadership. The briefing is a comprehensive 8,000-10,000 word daily news digest analyzed from a Marxist-Trotskyist perspective.

## Pipeline

The briefing is produced by a two-agent pipeline, automated via shell scripts:

1. **Research agent** (Sonnet) — Gathers raw news material, WSWS articles, and source data. Saves to `briefing/daily/YYYY-MM-DD_raw.md`
2. **Writer agent** (Opus) — Synthesizes the raw material into the final briefing. Saves to `briefing/daily/YYYY-MM-DD_full.md`
3. **Publication** — Publishes to the briefing site via `publish.sh`

German translation (`translate-briefing.sh`) is **disabled** and not part of the pipeline.

Production runs only on GitHub Actions (`.github/workflows/morning-briefing.yml`), inside a 02:30–04:30 ET window, at most 2 attempts/day. Do NOT re-enable the local launchd jobs. Manual run: Actions → Morning Briefing Pipeline → Run workflow (tick "force"), or locally `BRIEFING_FORCE=1 ./morning-briefing.sh`. Failure history and design rationale: `educational-materials/03-failure-debrief-and-relaunch-plan.md`.

## Key Files

- `briefing/briefing-format.md` — **The format guide.** The writer agent MUST follow this exactly.
- `.claude/agents/briefing-research.md` — Research agent definition
- `.claude/agents/briefing-writer.md` — Writer agent definition
- `morning-briefing.sh` — Full pipeline automation (research → write → publish)
- `translate-briefing.sh` — Translation utility (runs from /tmp to avoid loading project context)
- `publish.sh` — Publication script
- `.claude/launch.json` — Dev server config (Python HTTP on port 4321)

## Website

The briefing site provides search and archive functionality:
- `index.html` — Main briefing page (82 KB)
- `archive.html` — Archive interface
- `search.html` — Search interface
- `assets/style.css` — Styles
- `assets/app.js` — JavaScript (wrapSections uses `<div>` not `<section>`)
- `templates/` — HTML templates for briefing generation

## Editorial Policy

- Editorial independence applies to ALL news sections (Top stories, International, World economy, US, Science/Health)
- WSWS-only stories go exclusively in "WSWS coverage — last 24 hours"
- Every news section story needs at least one bourgeois press source
- Section summary bullets provide quick-scan for ICFI leaders (most critical fact, not headline restatement)

## Pipeline Technical Notes

- `translate-briefing.sh` and `publish.sh` require `unset CLAUDECODE` to run `claude` CLI
- Translation runs from `/tmp` to skip loading project CLAUDE.md/agents (saves tokens)
- macOS BSD `mktemp` requires X pattern at END of template (no suffix after XXXXXX)
- `.briefing-env` sourced for `CLAUDE_CODE_OAUTH_TOKEN` in headless launchd runs
- NEVER add `--output-format json` to agent/multi-turn calls — it broke the pipeline twice
- The pipeline shares Evan's Max-plan usage (same account): keep runs inside the early-morning window, and fail fast rather than retry on usage-limit errors
- Research calls hitting `--max-turns` print only `Error: Reached max turns (N)` and lose all output — keep turn caps generous and the budget note in prompts

## Git

This is a git repository (`EvanBlake17/icfi-briefing-site`). Commit and push changes as appropriate.
