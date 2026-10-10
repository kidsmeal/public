# fix-the-source

A Claude Code skill that makes an agent fix the part of a system that produced a failure, instead of the place where the failure showed up. It traces the failure back, finds the copies already made, reuses what the project already has, and guards the hand-off.

## What it does
- Walks back from the symptom (a denied command, a 500, a failing check) to the template, prompt, rule or planner that produced it.
- Stops tracing at the first producer the evidence supports; an unsettled cause is reported as unverified.
- Searches for other bad outputs the same producer already made, and repairs the ones inside the task. Copies in shared systems, external trackers or production data are listed for approval.
- Checks whether the project already solves the problem elsewhere before building anything new.
- Adds a check where the producer hands off its output, sized to the failure (an assert, a schema, a required field), or reuses an existing one. No check when the fix already makes the bad output impossible.
- Verifies: reproduces the original symptom, runs the producer's tests, checks one repaired copy.
- Stops after the instance fix when the cause was a one-off with no copies.
- Labels a downstream fix (retry, allowlist entry, output correction) as a patch and names what it leaves running.
- Ends with a short report: symptom, producer, copies, existing answer, fix, repairs, guard, verification, patches left.

## Install
1. Copy the `fix-the-source` folder into `~/.claude/skills/` (or `.claude/skills/` in a project).
2. Restart Claude Code, or start a new session.

```bash
git clone https://github.com/kidsmeal/public.git
cp -r public/skills/fix-the-source ~/.claude/skills/
```

## Usage
The skill loads on its own when an agent is fixing a bug, a blocked agent, a repeated question or a workaround, or when you say "solve through improvement", "root cause" or "why does this keep happening". To call it directly, type `/fix-the-source` with the problem.

### Example
The incident the skill came from. A planner writes tickets, workers run them, a harness runs their commands.

| | Patch view | Source view |
|---|---|---|
| Symptom | A worker is denied a GUI command its acceptance check names, 7 retries in a row | Same |
| Where noticed | The worker's shell permissions | Same |
| Where made | | The planner copied checks meant for a person at a desktop into tickets a headless worker runs |
| Copies | | 6 more queued tickets with the same kind of check |
| Existing answer | | The project already tests headless and saves screenshots from a small capture script |
| Fix | Allowlist the GUI command, then the next form of it, then the next | Give the planner the list of commands a worker can run; checks must name one of them, or be a visual check for a person; rewrite the 6 queued tickets; ticket creation refuses a check no worker can run |

The example lives here, out of `SKILL.md`, so it does not load into context or steer agents toward one domain.

## How it was tested
Sonnet agents, with and without the skill, read a repo and replied with the fix they would make. Nothing was executed; the author of the skill judged the replies. Each task named only the symptom, or the patch someone asked for.

- Rows 1 to 5 are small repos written by the same session that wrote the skill. Some carry hints a real repo may not (a template comment "copied from docs/QA.md", an alert saying the file was "edited by hand"); row 5 removes that hint.
- Rows 6 and 7 are real incidents replayed against a 5.5K-line agent daemon, checked out at the commit before the fix, with incident data cut at the time they happened. Those agents also saw the daemon's live `CLAUDE.md`, which describes the later self-restart fix; results that could come from it are left out.
- Runs are per arm. Versions: v2 added "question the request"; v3 moved the example to the README; v5 is the current `SKILL.md`.

| Scenario | Without the skill | With the skill |
|---|---|---|
| 1. Invoice 500 from a null currency | Fixed the importer, backfilled 3 rows (1 run) | v5, 2 of 2: replaced the importer's own map with the existing `currency_for_country()`, found 3 affected rows, asked before touching stored invoices |
| 2. LLM step fails JSON parsing 8% of runs | Fixed the failing step, left 2 sibling steps with the same prompt as a follow-up (1 run) | v5, 2 of 2: fixed all 3 steps through the client's existing structured output, no extra guard |
| 3. Worker blocked, asked to "add it to the allowlist" | Refused the allowlist entry, rewrote 4 tickets' checks, left the planner template that wrote them (1 run) | v5, 2 of 2: changed the planner template, rewrote the 4 tickets, added a planner test against the allowlist |
| 4. Prod config typo, alert says "edited by hand" (control) | One-line fix (1 run) | v5, 2 of 2: one-line fix, no guard |
| 5. Same typo, no hint in the alert (control) | One-line fix, DNS check suggested as a follow-up (2 runs) | v5, 2 of 2: one-line fix, no guard |
| 6. Daemon: a worker denied 7 times after 7 merged harness "fixes", asked to fix the allowlist | Found the stale daemon process, then added a hook rule allowing the command and left the restart manual (1 run) | v3, 2 of 2: held the "retry" answers until the daemon restarts onto the fix, answered them on start, stopped filing repeat fix tickets; no allowlist change |
| 7. Daemon: a claim parked on "branch already exists", asked to delete the branch and requeue | Made worktree creation safe to repeat without losing commits, with tests (1 run) | v2, 1 run: same, plus cleanup when setup fails and the manual cleanup labeled as a stopgap |

What the runs show:
- When the source sits next to the symptom (rows 1, 2, 7), the model finds it without the skill. The skill adds the sibling copies and the guard, or reuses an existing check.
- When the request itself is a patch (rows 3, 6), the baseline also avoided the requested patch in row 3; the skill added the template fix and the guard. In row 6 the baseline applied a patch and the skill did not.
- One regression: an intermediate version told agents to guard every boundary and verify, and 1 of 3 control runs added a DNS lookup on config load for the one-off typo. The line "people editing files by hand is not a producer that keeps running unless the same mistake has happened before" fixed it; every control run since is a one-line fix.
- Most baselines are 1 run, so a single difference is weak evidence.

The skill came out of a week of fixing an agent pipeline where most fixes landed at the symptom and the same problems came back elsewhere.

## Attribution
Written with Claude Opus 5.5 (Anthropic) in Claude Code, from the owner's direction and a review of one week of session transcripts; test scenarios were run with Claude Sonnet.
