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

## Findings from the local Mac investigation (Oct 6)

- **The Mac is clean.** Both launchd plists (`com.icfi.morning-briefing`, which polled every 5 minutes, and `-watchdog`) are in `~/Library/LaunchAgents/disabled/` and not loaded. There is no crontab, no Claude Desktop scheduled task, and no running briefing process. The last local production run was May 9.
- **The most common sub-step failure was running out of turns, not hitting quota.** Failed outputs contain `Error: Reached max turns (3)` or `(5)`, which is 28 bytes. When `claude -p` hits `--max-turns` it prints only that error and **throws away everything it gathered**. The tokens are spent and nothing comes back. Arts (3 turns) and economy/pseudo-left (5 turns) failed most often. The writer also hit `Reached max turns (30)` once (Apr 30).
- Other errors seen: `API Error: Stream idle timeout - partial response received`; one writer refusal under the Usage Policy (May 3); an auth-check failure on Aug 28. No local log contains a usage-limit message.
- **Same account:** the briefing's OAuth token belongs to the account Evan uses interactively, so it draws on the same 5-hour window and weekly cap. A new cloud routine, "Lehman count tracker refresh" (Opus, hourly 08:00–23:00, 16 runs a day), also draws on that account.
- Stale local memory files still list the cron as 10:00/11:00 UTC.

---

## Relaunch plan (decisions: same account; German stays off)

### Implemented on branch `claude/friendly-bohr-llulw0`

**Workflow (`.github/workflows/morning-briefing.yml`)**
- **Window 02:30–04:30 ET.** A 5-hour usage window opened by a ~3 AM run resets by ~8 AM, before the working day, and the briefing is ready well before 7 AM. The window is configurable through `BRIEFING_WINDOW_START/END`.
- **Seven cron fires at odd minutes** (06:17–09:17 UTC) cover the window in both EDT and EST. A **gate step** skips any fire that is outside the window, already published, or past the cap. A skip uses about 1 minute of Actions time and no Claude tokens.
- **At most 2 full attempts per day.** A counter in the Actions cache is incremented *before* the pipeline starts, so cancelled runs count too.
- A `concurrency` group means two runs never overlap.
- The job timeout is 60 min (was 90). Each run's log tail goes to the job summary, and artifacts are kept 90 days (was 30).
- `workflow_dispatch` has a **force** checkbox for manual runs.

**Script (`morning-briefing.sh`)**
- The time guard now applies to every run, using Eastern time (it was local-only, hour-based).
- The preflight now tests **Sonnet and Opus** (it used to test haiku). On a usage/rate-limit message it stops before research.
- Turn caps are raised (news/WSWS 10→15, science/economy 5→10, pseudo-left 5→12, arts 3→8). Every research prompt now states its turn budget and asks the model to print partial results instead of hitting the cap.
- **Fail fast:** if any failed research output contains a limit message, or 4 or more of the 6 calls fail within 90 seconds, the run stops with no retries and no writer.
- News and WSWS are now retried once too. The writer runs only if **both** news **and** WSWS succeeded (before, it ran unless both were empty).
- Writer: WebSearch is disabled (WebFetch stays for the Perspective date check) and the timeout is 30 min (was 60).
- Failure text such as `Reached max turns` is now written to the log.

### Remaining steps
1. Review and merge the branch into `main`.
2. Make sure the `CLAUDE_CODE_OAUTH_TOKEN` secret is still valid (the auth check failed on Aug 28). Regenerate it with `claude setup-token` if needed.
3. Run once by hand: Actions → Morning Briefing Pipeline → Run workflow, with **force** ticked.
4. Re-enable the workflow (it is currently `disabled_manually`).
5. Watch for 5 days. Pass criteria: published by 7 AM ET on 5 of 5 days, no attempts outside the window, at most 1 retry.
6. Optional: if GitHub's delays still push fires past 04:30 ET on some days, add an external trigger (for example cron-job.org POSTing to the `workflow_dispatch` API at 02:45 ET).

### Things to decide outside this repo
- The hourly Opus "Lehman count tracker" routine draws on the same weekly cap as the briefing.
- Update the stale memory files on the Mac (cron times), or delete them.
