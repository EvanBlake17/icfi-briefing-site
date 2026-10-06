# Pipeline failure debrief and relaunch plan

*Written October 6, 2026. Sources: git history, commit messages, GitHub Actions run history (runs 310–349), job logs from the last two runs. Run artifacts older than 30 days have expired, so the raw error text from the September 1 failures is gone.*

---

## Current state

- The workflow `Morning Briefing Pipeline` was **disabled manually** on September 1, 2026 (8:57 PM ET), after two failed runs that morning.
- The last published briefing is **August 31, 2026**.
- 349 workflow runs total since March 11.

---

## What went wrong: a timeline

| Period | Platform | Main failure | Fix applied |
|---|---|---|---|
| Feb 26 – Mar 1 | Mac launchd | `--output-format json` stopped multi-turn agents; `settings.local.json` blocked every tool when run headless | Flag removed, tools allowed (17c54c6, 74f5160) |
| Mar 2 | Mac launchd | Task-tool indirection: the agent ran for hours, exited 0, wrote no file | Switched to `--agent` flag (edd9596) |
| Mar 3 | Mac launchd | Auth preflight loaded the whole project and took **54 minutes** | Preflight uses haiku with no tools (1619dd2) |
| Mar 3–5 | Mac launchd | One big research agent (80 turns) failed **8+ days in a row**: its context filled up and it stalled after writing a skeleton | Replaced by 6 parallel focused `claude -p` calls (0aae309) |
| Mar 4 | Mac launchd | `--output-format json` came back in for token tracking and broke the agents again | Removed again (8c019a5) |
| Mar 6 | Mac launchd | Bash `$()` subshell left the research processes orphaned, so every call returned 0 bytes | Pass PIDs through a global variable (d8c62d2, 48d1c48) |
| Mar 11 | → GitHub Actions | The Mac's DarkWake sleep on battery killed runs | Moved to GitHub Actions |
| Apr 9 | Mac (still running!) | A "5-minute polling agent" on the Mac fired at midnight and produced stale briefings | Added a time-window guard (9d0c81a) |
| ~Apr–May | Mac + Actions | **The local launchd pipeline was still running alongside GitHub Actions for about 28 days.** The two diverged, so both were spending tokens. | `pull --rebase` in publish.sh (a306745) |
| Jun 18 | Actions | A hung retry call had no timeout and burned Sonnet tokens until the job was killed at 45 min | 300 s watchdog on retries; CI timeout raised to 90 min (28cb3a5) |
| Jun 19 | Actions | **The GitHub cron queue delayed runs by 1–6 hours**, which pushed the run into Evan's daytime 5-hour usage window | Cron moved to 07:00 + 08:00 UTC (257bff8) |
| Aug 17, 19, 26, 28 | Actions | Both cron slots ran the **full** pipeline on the same day: when the first run failed, the second ran everything again. On **Aug 19 the two runs overlapped**, and each was cancelled after 90 min with no output. That was about 3 hours of paid compute for nothing. | none |
| Sep 1 | Actions | Run 1: 4 of 6 research calls failed, the writer started on partial material and died after 4.5 min. Run 2: **every model call failed within 2 seconds**, while the haiku preflight had passed. | Workflow disabled |

### Root causes that still exist in the code

1. **The schedule is unreliable.** GitHub's `schedule:` trigger is best-effort. Since June 20 the cron has been set for 07:00 UTC, yet publish times ranged from 07:52 to 18:30 UTC. 11 of 66 briefings were published after 7 AM ET (11:00 UTC). Runs on Aug 27–28 started at about 2–3 PM ET.
2. **No concurrency control in CI.** The script says "In CI, GitHub Actions handles concurrency", but the workflow has no `concurrency:` key, so overlapping runs are possible (as on Aug 19).
3. **The two-slot cron doubles spending on bad days.** The "already published" check only stops the second run when the first one *succeeded*. After a failure, the second run starts the whole pipeline again.
4. **The preflight tests the wrong model.** It checks haiku, but the pipeline uses Sonnet and Opus. On Sep 1 haiku answered while every Sonnet/Opus call failed instantly. That pattern looks like a subscription usage limit or an Opus/Sonnet-specific error. The script then retried 4 calls and would have gone on to the writer anyway.
5. **No "stop" signal for usage limits.** The script doesn't look for "usage limit" or "rate limit" in the error output. It keeps retrying and still launches the Opus writer, which is the most expensive step, even when the research is partial.
6. **No upper bound on cost per run.** The writer gets up to 30 turns and 60 minutes with WebSearch/WebFetch enabled. On a bad day nothing stops it from spending heavily.
7. **No hard deadline.** A late-firing cron (for example at 2 PM ET) still runs the full pipeline in the middle of Evan's working day, using the same subscription he works with interactively.
8. **Error evidence expires.** The detailed error text goes only into a log artifact kept for 30 days. Nothing is written to the job summary.

---

## Relaunch plan

**Goal:** the briefing is published by 7:00 AM ET every day, no model calls run after ~7:30 AM ET, and a failed day costs at most one attempt plus one bounded retry.

### Phase 0: clean up the local machine (do this first)

The Mac may still have launchd jobs or a polling agent left over from the earlier setup. If they're still installed, they spend tokens and compete with CI. Use the local investigation prompt to find and disable them.

### Phase 1: make the trigger precise

Replace GitHub's best-effort cron with a reliable trigger that calls `workflow_dispatch`:

- **Recommended:** a Claude Code Routine or a free external scheduler (for example cron-job.org) that POSTs to the GitHub API `workflows/morning-briefing.yml/dispatches` at **5:00 AM ET**, with a second attempt at 6:00 AM ET. Starting at 5:00 leaves ~2 hours of slack before 7:00. Keep the GitHub `schedule:` only as a late backstop, and protect it with the deadline guard below.
- Use a timezone-aware schedule (for example `CRON_TZ=America/New_York`) so the DST double-cron hack goes away.

### Phase 2: stop the wasted spending (changes to the workflow and script)

1. Add `concurrency: { group: morning-briefing, cancel-in-progress: false }` to the workflow.
2. **Deadline guard (CI too):** compute the current hour in `America/New_York` and exit 0 before any model call if it's before 4:30 AM or after 7:30 AM.
3. **Attempt ledger:** record attempts for the day (for example a `briefing/attempts/YYYY-MM-DD` marker committed to the repo, or a run-count check through the API). Allow at most 2 attempts per day.
4. **Real preflight:** ping `--model sonnet` and `--model opus` with a one-word prompt. If either fails, `grep` the error for "limit", "rate", "overloaded" or "credit", write it to `$GITHUB_STEP_SUMMARY`, and stop before the research step.
5. **Fail fast on limits during research:** if two or more research calls fail in under 30 seconds, treat it as a quota problem. Don't retry and don't launch the writer.
6. **Gate the writer:** require *both* news and WSWS research to succeed (the current check fails only when both are empty).
7. **Bound the writer:** remove WebSearch/WebFetch from the writer (it has the raw material), lower the timeout to about 25 min (successful runs finish the whole pipeline in 15–20 min), and add a budget cap if the installed CLI supports one (`claude --help | grep -i budget`).
8. **Keep the evidence:** append the step timings and the last 20 stderr lines to `$GITHUB_STEP_SUMMARY`. Raise artifact retention to 90 days.

### Phase 3: dry run, then go live

1. Run once by hand via `workflow_dispatch` with `BRIEFING_FORCE=1`, at an off-hours time.
2. Re-enable the workflow and turn on the external trigger.
3. Watch for 5 days: start time, finish time, and attempts per day. Pass criteria: published by 7 AM ET on 5 of 5 days, no runs after 7:30 AM ET, and no more than 1 retry.

### Open questions for Evan

- Which plan is `CLAUDE_CODE_OAUTH_TOKEN` tied to (Max 5x or 20x), and is it the same account you use interactively? If it is, the briefing shares your 5-hour window and weekly cap. A separate account, or an API key with a hard monthly spend limit, would isolate it completely.
- Which hours count as "peak" for you: the hours you work interactively, or Anthropic's peak-demand hours? The 4:30–7:30 AM ET window above avoids both. Anthropic's weekday peak was 5–11 AM PT (8 AM–2 PM ET), and third-party reports say peak throttling was lifted for Pro/Max in May 2026, so check this against your own usage page.
- Should the German translation stay disabled? (It was turned off on Mar 3, and CLAUDE.md still describes it as active.)
