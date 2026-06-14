# Gantry example - cross-model review (codex reviewing Gantry)

A real run of Gantry's phase-reviewer routed to a different model family. The per-role
model-backend feature lets a project send a reviewer or planner to an external model while the
implementer stays on the Claude Code harness. This run is that feature reviewing its own diff:
the phase-reviewer was pointed at OpenAI's codex (`gpt-5.5`) via `role.js`, and codex returned a
verdict in the phase-reviewer's own format.

This is a dogfood run, separate from the phase-hooks and capsule-castle records.

## Files

- `2026-06-14-codex-cross-model-phase-review.md` - the phase review, run by codex `gpt-5.5`
  instead of a native Claude subagent. Verdict: FAIL on three findings, with an honest triage of
  which are real.

## What this run shows

The delegation path works end to end. `role.js run phase-reviewer` composed the prompt from the
real `phase-reviewer.md`, shelled out to `codex exec`, and codex gathered the diff, ran the
project's own `node --test` (112 pass) as its evidence, and returned a PASS/FAIL verdict with
file:line citations in the exact format the phase-reviewer specifies. A reviewer from a different
model family produced a usable gate result through the same plumbing a native subagent uses.

## What this run does not show

It is not a controlled comparison: the same diff was not also reviewed by a native Claude
phase-reviewer, so this does not measure codex against Claude as a reviewer, only that the path
runs and returns a real review. The FAIL is also partly an artifact of the test setup (the diff
included a `.gantry/models.json` that routed the reviewer to codex for this very test), which is
called out in the run file. Codex's own `git grep` calls errored a few times on Windows
PowerShell quoting before it recovered with other commands; that noise is the external CLI, not
Gantry. Read this as a worked record that the reviewer role can run on another model, not a claim
about which model reviews better.
