# Phase enforcement hooks - Design

Status: draft
Intent: turn Gantry's two softest contract claims (the implementer stays in its phase, no agent commits during a run) into mechanical PreToolUse hooks, so the phase boundary is a gate rather than a promise.

## Problem

P0 softened the README's overclaims to honest contract language. That removed the liability but left the gap it was papering over: the phase boundary and the no-commit rule are still prompt-level. An implementer subagent can write a file outside its phase's file list, and any agent in the run can `git commit`, because nothing stops it but the instruction not to.

The differentiator we want is "the only gated pipeline where the phase boundary is a hook, not a hope." Two specific failures are worth making mechanically impossible during an active phase:

1. **Scope drift.** The implementer edits a file the plan did not list for this phase, expanding scope silently instead of reporting it.
2. **An unreviewed commit.** An agent commits or pushes mid-phase, before the human has reviewed the diff at the gate.

Everything else (a disabled test, a convention violation) stays the phase-reviewer's job, because those need judgment a hook cannot make. These two are pure path/string checks, so a hook can own them.

## Design

The hooks are dumb. A sentinel file holds the run state, and each hook only asks two questions: "is enforcement opted in?" and "is a phase active, and is this call allowed?"

### Unit 1: the sentinel

`.gantry/active-phase.json` at the project root, written by the pipeline when a phase starts and cleared at the commit gate. Transient run state, gitignored.

```json
{
  "plan":    "docs/phase-hooks-design-plan.md",
  "phase":   3,
  "files":   ["plugins/gantry/scripts/hooks/file-list-guard.js", "plugins/gantry/hooks/hooks.json"],
  "allow":   ["docs/phase-hooks-design-plan.md", "CURRENTNESS_AUDIT.md", "RUNTIME_VERIFICATION_QUEUE.md", "ROADMAP.md"],
  "started": "2026-06-12T14:02:00Z",
  "session": "<claude session id, for staleness>"
}
```

- `files`: the phase's file list, copied verbatim from the plan. These are the only code paths the implementer may write this phase.
- `allow`: Gantry-managed bookkeeping docs the orchestrator writes during a phase (the plan file itself for status-line flips, the audit docs, the roadmap). Without this, the guard would block Gantry's own plumbing.
- `started` + `session`: staleness inputs (see Edge cases).

Active = the file exists and is not stale. No file = no active phase = every guard is a no-op.

### Unit 2: the opt-in marker

`.gantry/enabled` (an empty marker file, committed so a team shares the choice). The hook scripts read it first and exit 0 (allow, silent) if it is absent. `/gantry:init` creates it after asking the user. This is what makes plugin-native hooks opt-in: they ship and load for every plugin install, but do nothing until a project opts in.

### Unit 3: the two hooks

Shipped plugin-native in `plugins/gantry/hooks/hooks.json` so they fire reliably for the whole session, including tool calls made inside the implementer subagent (settings.json hooks are ambiguous about reaching inside subagents; plugin-native ones are not).

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write|MultiEdit|NotebookEdit",
        "hooks": [{ "type": "command", "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/file-list-guard.js" }] },
      { "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/commit-guard.js" }] }
    ]
  }
}
```

**file-list-guard.js** (matcher `Edit|Write|MultiEdit|NotebookEdit`):
1. If no `.gantry/enabled` marker, exit 0.
2. If no active (non-stale) sentinel, exit 0.
3. Normalize `tool_input.file_path` to a project-relative POSIX path. Normalize each entry in `files` and `allow` the same way.
4. If the target is in `files` or `allow`, exit 0.
5. Otherwise print the deny JSON with: `outside phase <N>'s file list. report this as scope drift, or amend the plan and re-run /gantry:build to widen the phase. (to clear enforcement by hand: delete .gantry/active-phase.json)`

**commit-guard.js** (matcher `Bash`):
1-2. Same opt-in + active checks.
3. If `tool_input.command` matches `git` followed by `commit` or `push` (allowing for flags and leading path, but not matching the substring inside an unrelated argument), print the deny JSON: `Gantry holds the commit gate. phase <N> is mid-build and not yet reviewed. finish /gantry:review and commit at the gate. (to clear: delete .gantry/active-phase.json)`
4. Otherwise exit 0.

Block contract (verified against current docs): print to stdout, exit 0:
```json
{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "<message>" } }
```
The reason text is fed back to the model, so the deny is actionable, not a silent wall.

### Unit 4: lifecycle wiring

The sentinel is written and cleared by the pipeline, not the hooks:

- `/gantry:build <plan> <phase>` writes the sentinel (plan, phase, files from that phase, the standard allow-list) before spawning the implementer.
- The FAIL -> fix -> re-review loop keeps the sentinel active (the implementer re-edits the same `files`).
- `/gantry:review` clears the sentinel when it presents a clean diff for commit (PASS, or PASS-WITH-NOTES with only deferred notes). Clearing it is what opens the commit gate: the human's commit at the gate is allowed because no phase is active.
- The orchestrator `SKILL.md` does the same writes/clears when it drives the full `/gantry:run`.

### Unit 5: init opt-in + README

- `init.js` gains a step: detect whether running as a plugin (so `${CLAUDE_PLUGIN_ROOT}` resolves), and if so, offer to write `.gantry/enabled` and add `.gantry/active-phase.json` to `.gitignore`. Print what it did. Declining leaves the hooks inert.
- README's enforcement section gets a short "what is mechanical vs contract" block: file-list and commit/push are hook-enforced when opted in; everything else is contract plus the phase-reviewer reading the diff.

## Contracts touched

- **New `plugins/gantry/hooks/hooks.json`** (plugin-native). Loads for every plugin install. Compatibility: inert without `.gantry/enabled` + an active sentinel, so installing the update changes nothing for anyone until they opt in. Manual-copy installs do not get it at all (no plugin), which preserves "manual copy works without the hooks."
- **New `plugins/gantry/scripts/hooks/{file-list-guard,commit-guard}.js`** plus a shared helper for sentinel read + path normalization. Plain node, zero deps, bundled runtime. Must fail open.
- **`init.js`** gains the opt-in write and `.gitignore` edit. Still never overwrites; the marker write is additive and asks first.
- **`commands/build.md`, `commands/review.md`, `skills/gantry/SKILL.md`** gain sentinel write/clear instructions. These are doc edits that change orchestrator behavior, not code.
- **`.gitignore`**: `.gantry/active-phase.json` ignored; `.gantry/enabled` committed.
- No schema, no network, no new runtime dependency.

## Edge cases

- **Stale sentinel (the main footgun).** A session dies mid-phase; the sentinel lingers and a later unrelated session would have edits blocked. Guard: the hook treats a sentinel as stale and ignores it (printing a one-line "stale Gantry sentinel, ignoring" note, exit 0) when its `session` differs from the current session id AND its `started` is older than a threshold (proposed 6 hours). `/gantry:build` always overwrites the sentinel fresh. Every deny message names the file to delete for a manual clear.
- **Hook script error.** Any unhandled error, malformed sentinel, or unreadable marker makes the hook **fail open**: exit 0, allow the call. A buggy guard must never brick the repo. The cost is a missed enforcement, which the phase-reviewer still catches on the diff.
- **Windows paths.** `tool_input.file_path` arrives absolute and may use backslashes; `files`/`allow` are repo-relative POSIX. Normalization lowercases drive letters as needed, converts separators to `/`, and compares project-relative. This runs on the maintainer's Windows machine, so it is a primary case, not a footnote.
- **Plan amended mid-phase.** The implementer legitimately needs a file the planner missed. Correct flow: guard denies, implementer reports scope drift, human amends the plan and re-runs `/gantry:build` (which rewrites the sentinel's `files`). The guard is the forcing function for that conversation, which is the point.
- **`git commit` substring false positives.** A command like `echo "how to git commit"` should not be blocked. The matcher keys on `git` as the command head followed by a `commit`/`push` subcommand, not a bare substring.
- **No jq.** Scripts parse stdin JSON in node directly; no shell-tool dependency.
- **Multiple plans / phases.** Gantry builds one phase at a time, so a single sentinel is sufficient; a second `/gantry:build` overwrites.

## Out of scope

- Destructive git beyond commit/push (`reset --hard`, `checkout --`, `clean -fd`). The README's broader "no destructive git" claim stays contract language for now; this phase only mechanizes commit/push.
- Hook-enforcing the design and plan gates. Only build (file list) and commit are hooked.
- A `settings.json`-based install path. Plugin-native + marker is the one mechanism.
- Blocking reads, or any non-mutating tool.

## Open questions

- Staleness threshold: 6 hours proposed. Too long leaves a wider window where a crashed run blocks edits; too short risks a slow legitimate phase self-clearing. (session-id mismatch already covers the cross-session case; the timer only matters within one long session.)
- Is `.gantry/enabled` the right opt-in signal, or should the presence of the scaffolded audit docs imply opt-in? Proposed: an explicit marker, so opting into the docs does not silently opt into enforcement.
- Deny message wording: drafts above; final wording wants to be unmistakably actionable.
