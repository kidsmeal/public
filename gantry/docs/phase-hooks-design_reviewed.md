# Phase enforcement hooks - Design

Status: approved (reviewed twice 2026-06-12; all 7 flagged decisions resolved; ready for phase planning)
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
  "allow":   ["docs/phase-hooks-design-plan.md", "docs/CURRENTNESS_AUDIT.md", "docs/RUNTIME_VERIFICATION_QUEUE.md"],
  "started": "2026-06-12T14:02:00Z",
  "session": "<claude session id from PreToolUse stdin, for staleness>"
}
```

- `files`: the phase's file list, copied verbatim from the plan. These are the only code paths the implementer may write this phase.
- `allow`: Gantry-managed bookkeeping docs the orchestrator writes during a phase (the plan file itself for status-line flips, the two audit docs). The sentinel writer (see Unit 4) computes their real paths at write time, mirroring init.js's docDir logic (docs/ when a docs/ dir exists, else repo root), so the guard matches them wherever init.js scaffolded them.
- `started` + `session`: staleness inputs (see Edge cases).

**Resolved (allow-list source of truth):** the allow-list is not a hardcoded literal. The sentinel writer computes it: the plan path passed to `/gantry:build`, plus the two scaffolded audit doc paths resolved the same way init.js resolves them (docs/ vs root). ROADMAP.md is dropped: it is a leftover from the source game project's `.claude/`, and Gantry never scaffolds or references it. If a project happens to keep a ROADMAP.md and the orchestrator updates it mid-phase (the SKILL.md roadmap-sync step), the writer adds it to `allow` only when that file actually exists.

**Observable verification (testability):** the repo has a test framework (`node --test`, `test/*.test.js`; package.json `scripts.test` is `node --test`). Sentinel read + path normalization must ship with unit tests in `test/` matching the existing pattern (`init.test.js`, `version.test.js`): given a sentinel JSON and a `tool_input.file_path`, the shared helper returns allow/deny deterministically across the path cases in Edge cases.

Active = the file exists and is not stale. No file = no active phase = every guard is a no-op.

### Unit 2: the opt-in marker

`.gantry/enabled` (an empty marker file, committed so a team shares the choice). The hook scripts read it first and exit 0 (allow, silent) if it is absent. `/gantry:init` creates it after asking the user. This is what makes plugin-native hooks opt-in: they ship and load for every plugin install, but do nothing until a project opts in.

### Unit 3: the two hooks

Shipped plugin-native in `plugins/gantry/hooks/hooks.json` so they fire for the session's tool calls.

**Resolved (subagent reachability):** verified against current Claude Code hook docs (code.claude.com/docs/en/hooks.md and sub-agents.md). Plugin-native PreToolUse hooks fire for tool calls made inside a subagent spawned via the Agent/Task tool, not only for the top-level agent. This is the documented behavior and is the reason for shipping plugin-native rather than via settings.json, where subagent reach is not documented. The implementer is always a subagent, so this is load-bearing and now confirmed before any code is written.

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write|MultiEdit",
        "hooks": [{ "type": "command", "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/file-list-guard.js" }] },
      { "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/commit-guard.js" }] }
    ]
  }
}
```

**file-list-guard.js** (matcher `Edit|Write|MultiEdit`):
1. If no `.gantry/enabled` marker, exit 0.
2. If no active (non-stale) sentinel, exit 0.
3. Normalize `tool_input.file_path` to a project-relative POSIX path. Normalize each entry in `files` and `allow` the same way.
4. If the target is in `files` or `allow`, exit 0.
5. Otherwise print the deny JSON with: `outside phase <N>'s file list. report this as scope drift, or amend the plan and re-run /gantry:build to widen the phase. (to clear enforcement by hand: delete .gantry/active-phase.json)`

**Resolved (matched-tool field names):** the matcher is narrowed to `Edit|Write|MultiEdit`, all three of which expose the target as `tool_input.file_path`. NotebookEdit is dropped from the matcher: it names its target `notebook_path`, and notebook edits are not part of any Gantry build flow, so guarding them adds a field-name special case for no real coverage. The guard still defends against a missing `file_path` by failing open (exit 0) with a logged note, so a future tool that slips through the matcher with a different field name cannot brick edits.

**commit-guard.js** (matcher `Bash`):
1-2. Same opt-in + active checks.
3. If `tool_input.command` matches `git` as the command head followed by a `commit` or `push` subcommand (allowing for flags and a leading `-C <path>` / path argument, but not matching the substring inside an unrelated argument), print the deny JSON: `Gantry holds the commit gate. phase <N> is mid-build and not yet reviewed. finish /gantry:review and commit at the gate. (to clear: delete .gantry/active-phase.json)`
4. Otherwise exit 0.

Note: a Bash command can chain commits (`foo && git commit ...`, `x; git push`, a subshell). The matcher must scan for a `git commit`/`git push` invocation anywhere a new command can start in the string, not only at the head, or the guard is trivially bypassed by prefixing any no-op. See Edge cases for the false-positive constraint, which still holds.

Block contract (verified against current docs): print to stdout, exit 0:
```json
{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "<message>" } }
```
The reason text is fed back to the model, so the deny is actionable, not a silent wall.

### Unit 4: lifecycle wiring

The sentinel is written and cleared by a dedicated script, never by an agent file op (this is the deadlock fix, below):

- `/gantry:build <plan> <phase>` runs `node ${CLAUDE_PLUGIN_ROOT}/scripts/sentinel.js write <plan> <phase>` before spawning the implementer. `sentinel.js` reads the phase's file list from the plan, computes the allow-list (plan path + scaffolded audit docs), stamps `started` + `session`, and writes `.gantry/active-phase.json`. Ordering note: this write must complete before the implementer subagent is spawned (the implementer's first edit could otherwise race ahead of an absent sentinel and the guard would no-op). Because the write is a synchronous `node` Bash call that the orchestrator issues and waits on before the spawn step, the ordering holds without extra locking; there is at most one writer at a time (one phase builds at a time, see Edge cases).
- The FAIL -> fix -> re-review loop keeps enforcement active. On FAIL, before the fix pass re-spawns the implementer, `/gantry:review` (and SKILL.md Stage 3) call `node ${CLAUDE_PLUGIN_ROOT}/scripts/sentinel.js add-files <cited-path>...` with the file paths from the reviewer's Required fixes / Fix-now notes. That appends those paths to the active sentinel's `files`, so the fix pass can touch exactly what the reviewer cited and nothing else.

**Resolved (fix-mode scope, decided B):** the authorization model is "an edit is allowed iff the plan listed the file OR the reviewer cited it." `implementer.md` is left as-is (its line 29 already authorizes cited-but-unlisted locations in fix mode); the sentinel is widened to match, rather than tightening the contract. The widening is not silent scope drift: the reviewer's findings are written and relayed to the human, so the cited paths are an explicit record before any fix edit lands. The orchestrator already holds those findings (it sends them to the implementer in fix mode), so passing the same paths to `sentinel.js add-files` adds no new parsing surface. Rejected alternatives: tightening `implementer.md` to make the plan list a hard ceiling (rewrites a working contract and adds a human round-trip to a common review outcome); and clearing the sentinel during the fix pass (runs the fix ungated, leaning on the prompt-level re-review at exactly the moment a looping agent is most likely to drift).
- `/gantry:review` runs `node ${CLAUDE_PLUGIN_ROOT}/scripts/sentinel.js clear` when it presents a clean diff for commit (PASS, or PASS-WITH-NOTES with only deferred notes). Clearing it is what opens the commit gate: the human's commit at the gate is allowed because no phase is active. Ordering note: the clear must complete before the human is told it is safe to commit; review.md already stops and hands the commit to the human, so the `clear` call sits at the same point as the "ready to commit" status flip, ahead of any commit attempt.
- The orchestrator `SKILL.md` runs the same `sentinel.js write`/`clear` calls when it drives the full `/gantry:run`.

**Resolved (write mechanism + deadlock):** a dedicated `scripts/sentinel.js` owns all sentinel read, write, and clear, invoked via Bash as `node .../sentinel.js write|clear`. This dissolves the deadlock two ways at once. The file-list guard matches `Edit|Write|MultiEdit`, never Bash, so a `node` invocation that writes the sentinel through `fs` is invisible to it: the sentinel is never written via the Write tool, so it never needs to be on its own allow path. The commit guard matches Bash but only denies `git commit`/`git push`, so a `node sentinel.js` Bash call passes untouched. No agent ever issues a raw Write or `rm` against the sentinel, so the guards cannot block Gantry's own plumbing.

### Unit 5: init opt-in + README

- `init.js` gains a step gated on `process.env.CLAUDE_PLUGIN_ROOT` being set (see resolution): if set, offer to write `.gantry/enabled` and ensure `.gantry/active-phase.json` is gitignored. The repo has no `.gitignore` today, so this step must create one if absent and append the entry if present (idempotently, never duplicating the line), consistent with init.js's "never overwrite, additive only" stance. Print what it did. Declining leaves the hooks inert.
- README's enforcement section gets a short "what is mechanical vs contract" block: file-list and commit/push are hook-enforced when opted in; everything else is contract plus the phase-reviewer reading the diff.

**Resolved (plugin-vs-manual signal):** the distinguishing signal is `process.env.CLAUDE_PLUGIN_ROOT`. Claude Code sets it only when a command runs as part of an installed plugin; it is absent for a manual copy into a project's `.claude/`. So init.js offers the opt-in marker only when `CLAUDE_PLUGIN_ROOT` is set. A manual copy never sees the offer and never gets the marker, and since a manual copy also has no `hooks/hooks.json` loaded, the hooks are doubly absent for it. This is exactly the "manual copy works without the hooks" contract.

## Contracts touched

- **New `plugins/gantry/hooks/hooks.json`** (plugin-native). Loads for every plugin install. Compatibility: inert without `.gantry/enabled` + an active sentinel, so installing the update changes nothing for anyone until they opt in. Manual-copy installs do not get it at all (no plugin), which preserves "manual copy works without the hooks."
- **New `plugins/gantry/scripts/hooks/{file-list-guard,commit-guard}.js`** plus a shared helper for sentinel read + path normalization. Plain node, "use strict", zero deps, bundled runtime, top-of-file block comment per house style (see init.js / version.js). Must fail open. Ships with `test/` coverage in the existing `node --test` style.
- **New `plugins/gantry/scripts/sentinel.js`** owns sentinel write/clear/add-files (and the file-list/allow-list computation from a plan + phase). Subcommands: `write <plan> <phase>`, `clear`, and `add-files <path>...` (appends reviewer-cited paths to the active sentinel's `files` on a FAIL fix pass, idempotently). Invoked via Bash by build.md, review.md, and SKILL.md. Same house style and `test/` coverage. The shared sentinel-read + path-normalization helper is used by both the guards and this writer, so the read and write sides cannot drift.
- **`init.js`** gains the opt-in write and `.gitignore` create-or-append. Still never overwrites; the marker write is additive and asks first. New behavior gets a case in `test/init.test.js`.
- **`commands/build.md`, `commands/review.md`, `skills/gantry/SKILL.md`** gain sentinel write/clear instructions. These are doc edits that change orchestrator behavior, not code. build.md and SKILL.md Stage 3 currently spawn the implementer directly with no sentinel write; the write step must be inserted ahead of that spawn. review.md and SKILL.md Stage 3 must place the `clear` at the "ready to commit" point, and on FAIL must call `sentinel.js add-files` with the reviewer's cited paths before the fix pass re-spawns the implementer.
- **`.gitignore`**: created if absent; `.gantry/active-phase.json` ignored; `.gantry/enabled` committed.
- No schema, no network, no new runtime dependency.

## Edge cases

- **Stale sentinel (the main footgun).** A session dies mid-phase; the sentinel lingers and a later unrelated session would have edits blocked. Guard: the hook treats a sentinel as stale and ignores it (printing a one-line "stale Gantry sentinel, ignoring" note, exit 0) when its `session` differs from the current session id AND its `started` is older than a threshold (proposed 6 hours). `/gantry:build` always overwrites the sentinel fresh. Every deny message names the file to delete for a manual clear. **Resolved (session id availability):** confirmed against current docs that PreToolUse stdin carries `session_id` (alongside `cwd`, `hook_event_name`, `tool_name`, `tool_input`). The session-mismatch half of the staleness rule runs as designed: the hook compares the payload's `session_id` to the sentinel's `session`. Both halves of the rule (cross-session mismatch and the in-session timer) are available.
- **Hook script error.** Any unhandled error, malformed sentinel, or unreadable marker makes the hook **fail open**: exit 0, allow the call. A buggy guard must never brick the repo. The cost is a missed enforcement, which the phase-reviewer still catches on the diff.
- **Windows paths.** `tool_input.file_path` arrives absolute and may use backslashes; `files`/`allow` are repo-relative POSIX. Normalization lowercases drive letters as needed, converts separators to `/`, and compares project-relative. This runs on the maintainer's Windows machine, so it is a primary case, not a footnote. The project root for relativizing comes from `CLAUDE_PROJECT_DIR` / `GANTRY_PROJECT_DIR` / `cwd`, matching init.js's `ROOT` resolution. Fail-open caveat: a wrong-but-valid root (e.g. `cwd` is a subdirectory of the project) does not throw - it silently relativizes the target to a path that will not match any `files` entry, so the guard would DENY a legitimate edit. That is a fail-CLOSED path, which violates the fail-open rule above. The guard must treat "computed target path escapes the project root" or "no resolvable project root" as fail-open (exit 0 with a logged note), not as a deny, so a misresolved root can never brick edits.
- **Plan amended mid-phase.** The implementer legitimately needs a file the planner missed. Correct flow: guard denies, implementer reports scope drift, human amends the plan and re-runs `/gantry:build` (which rewrites the sentinel's `files`). The guard is the forcing function for that conversation, which is the point.
- **`git commit` substring false positives.** A command like `echo "how to git commit"` should not be blocked. The matcher keys on `git` as a command head (start-of-string or after a shell separator `&&`, `;`, `|`, `(`) followed by a `commit`/`push` subcommand, not a bare substring inside a quoted argument.
- **No jq.** Scripts parse stdin JSON in node directly; no shell-tool dependency.
- **Multiple plans / phases.** Gantry builds one phase at a time, so a single sentinel is sufficient; a second `/gantry:build` overwrites. This single-writer property is also what keeps the Unit 4 write/clear ordering free of races: there is never a second concurrent build writing the same sentinel.

## Out of scope

- Destructive git beyond commit/push (`reset --hard`, `checkout --`, `clean -fd`). The README's broader "no destructive git" claim stays contract language for now; this phase only mechanizes commit/push.
- Hook-enforcing the design and plan gates. Only build (file list) and commit are hooked.
- A `settings.json`-based install path. Plugin-native + marker is the one mechanism.
- Blocking reads, or any non-mutating tool.

## Open questions

Five of the six review-flagged decisions are resolved above. One new decision surfaced in re-review (the fix-mode scope of the sentinel's `files`, flagged inline in Unit 4) and must be made before planning. Remaining choices below are minor and have decided defaults; none block planning:

- Staleness threshold: **decided 6 hours.** Session-id mismatch already covers the cross-session case (the common one), so the timer only matters inside a single very long session. 6h is comfortably longer than any real phase and short enough that a crash-then-resume in the same session self-heals by end of day.
- Opt-in signal: **decided** an explicit `.gantry/enabled` marker, not "audit docs imply opt-in." Opting into the docs must not silently opt into enforcement.
- Deny message wording: drafts above are the working copy; final wording is a tuning pass during the build phase that adds the guards, not a design decision.
