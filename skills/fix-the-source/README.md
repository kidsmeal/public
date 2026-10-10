# fix-the-source

A Claude Code skill that makes an agent fix the part of a system that produced a failure, instead of the place where the failure showed up. It traces the failure back, finds the copies already made, reuses what the project already has, and guards the hand-off.

## What it does
- Walks back from the symptom (a denied command, a 500, a failing check) to the template, prompt, rule or planner that produced it.
- Searches for other bad outputs the same producer already made, and repairs them with the source fix.
- Checks whether the project already solves the problem elsewhere before building anything new.
- Adds a check where the producer hands off its output, sized to the failure (an assert, a schema, a required field).
- Stops after the instance fix when the cause was a one-off with no copies.
- Labels a downstream fix (retry, allowlist entry, output correction) as a patch and names what it leaves running.
- Ends with a short report: symptom, producer, copies, existing answer, fix, repairs, guard, patches left.

## Install
1. Copy the `fix-the-source` folder into `~/.claude/skills/` (or `.claude/skills/` in a project).
2. Restart Claude Code, or start a new session.

```bash
git clone https://github.com/kidsmeal/public.git
cp -r public/skills/fix-the-source ~/.claude/skills/
```

## Usage
The skill loads on its own when an agent is fixing a bug, a blocked agent, a repeated question or a workaround, or when you say "solve through improvement", "root cause" or "why does this keep happening". To call it directly, type `/fix-the-source` with the problem.

## How it was tested
Each scenario was run by a Sonnet agent with and without the skill. Each task named only the symptom or the patch someone asked for. The first four are small repos; the last two are real incidents replayed against a 5.5K-line agent daemon, checked out at the commit before they were fixed, with incident data cut at the time they happened.

| Scenario | Without the skill | With the skill |
|---|---|---|
| Invoice 500 from a null currency | Fixed the importer, backfilled 3 rows | Same, plus a required-currency check on the model |
| LLM step fails JSON parsing 8% of runs | Fixed the one failing step, left 2 sibling steps with the same prompt as a follow-up | Fixed all 3 steps through the client's existing structured output |
| Worker blocked, asked to "add it to the allowlist" | Refused the allowlist entry, rewrote 4 tickets' checks, left the planner template that wrote them | Changed the planner template, rewrote the 4 tickets, made the planner refuse checks the runner cannot execute |
| Prod config typo (control) | One-line fix | One-line fix |
| Daemon: a worker denied 7 times after 7 merged harness "fixes", asked to fix the allowlist | Found the stale daemon process, then added a hook rule allowing the command and left the restart manual | Held the "retry" answers until the daemon restarts onto the fix, answered them on start, stopped filing repeat fix tickets, added a self-restart exit code; no allowlist change |
| Daemon: a claim parked on "branch already exists", asked to delete the branch and requeue | Made worktree creation safe to repeat without losing commits, with tests | Same, plus cleanup when setup fails and the manual cleanup labeled as a stopgap |

Where the source sits next to the symptom, a strong model already finds it; the skill adds the sibling copies and the guard. Where the request itself is a patch (the allowlist cases), the skill changes the answer.

The skill came out of a week of fixing an agent pipeline where most fixes landed at the symptom and the same problems came back elsewhere.

## Attribution
Written with Claude Opus 5.5 (Anthropic) in Claude Code, from the owner's direction and a review of one week of session transcripts; test scenarios were run with Claude Sonnet.
