# Release hardening — Improvement Plan

Handoff doc for an implementing agent. Produced 2026-06-12. Scope: what Gantry must prove before a public release, distilled from a field post-mortem of two token-reduction tools (RTK, llmtrim) whose interception layers failed the same way — a hook/filter sitting between the agent and reality silently substituted its judgment, the safety net that was supposed to catch it structurally never fired on real-world input, and users paid the cost as confused retries. Gantry's PreToolUse guards are the same *shape* of component, so every lesson maps to a concrete item below. Design decisions are baked in; if the code contradicts a premise here, stop and flag rather than improvise.

## Ground rules

- Read `gantry/docs/phase-hooks-plan.md` first, especially "Cross-cutting concerns" and "Deferred review notes". Items R1 and R6 below promote two of those deferred notes to release blockers.
- The standing invariants hold for every item: zero dependencies, no network calls, fail-open on ANY guard error, gate-don't-rewrite (a guard only allows or denies; it never mutates a tool call), and all sentinel mutation through `node sentinel.js`.
- `node --test` from repo root must stay green after every item.

## The failure class this plan defends against

1. **Silent intervention.** RTK rewrote agent commands in place; llmtrim's folding deleted the one failing test from a 341-line log while keeping passing noise. Anything a gate does invisibly becomes corruption when it has a bug.
2. **Safety nets that can't fire.** llmtrim's "re-run ships the full output" rail was gated on raw-text equality, so any non-deterministic output (timestamps — i.e. every test/build log) could never trigger it. The net looked fine and was structurally dead.
3. **Happy-path evidence.** Both tools benchmarked the cases that fit. The hard case (signal buried in noise, hostile path shapes, the other platform) is where they died in the field.

Gantry's existing posture (fail-open, reported-not-silent drift, no network, plain JS) is already the antidote. This plan is about *proving* the safety paths, not redesigning them.

## R1. Host-independent path normalization — RELEASE BLOCKER

**Why.** `test/sentinel-core.test.js` test 19 ("normalize: Windows absolute backslash path matches repo-relative POSIX files entry") fails on a POSIX host today: `normalize()` returns `FAIL_OPEN` because it relies on host `path` semantics (already logged as deferred note 1 in phase-hooks-plan.md). Fail-open is the correct degradation, but the consequence is that **the file-list guard silently never enforces for Windows-style paths on a POSIX host (and vice versa)** — a safety gate that structurally cannot fire for a whole class of input is failure class #2 above, and it ships in the highest-blast-radius component. "Windows pinned primary" was acceptable for the internal phase; it is not acceptable for a public release that advertises platform-agnostic operation.

**Change.** In `plugins/gantry/scripts/sentinel-core.js`, stop relying on host semantics: detect the path style per input (a leading drive-letter (`/^[A-Za-z]:[\\/]/`) or backslash separators selects `path.win32`; otherwise `path.posix`) and normalize both the target and the files-list entries to one canonical comparison form (forward slashes, case handling per the win32/posix choice). The helper stays pure and throw-free; every genuinely unresolvable input still returns the fail-open signal.

**Tests** (`test/sentinel-core.test.js`): existing test 19 goes green on a POSIX host with no platform-conditional skips. Add the mirror cases: POSIX absolute path against a Windows-style files entry; mixed-separator path; drive-letter with forward slashes (`C:/repo/src/a.js`). Every case asserts the *direction* (match vs no-match), not just "did not throw".

**Exit criteria.** Full suite green on a POSIX host (`52/52`); the same suite is expected green on Windows (assert nothing host-conditional); `normalize()` returns `FAIL_OPEN` only for the enumerated error inputs, and a test enumerates them.

## R2. Guard dry-run mode — the "try it on your own data" affordance

**Why.** The single thing that let a stranger falsify llmtrim's claims in ten minutes — and the single thing that built trust in its author — was an offline filter (`compress` on stdin) that shows exactly what the tool would do, with no daemon and no enforcement. Gantry's equivalent costs little and pre-empts the "what would this hook do to MY repo?" fear that blocks adoption of anything that loads a PreToolUse hook on `Edit|Write|Bash` for every session.

**Change.** `sentinel.js` gains a `check <tool-name> <file_path-or-command>` subcommand: reads the live sentinel exactly like the guards do, prints one line — `would ALLOW` / `would DENY` plus the reason (which phase, which files entry matched or didn't, or which fail-open condition fired) — and always exits 0. It enforces nothing and writes nothing. Reuse the Phase-1 helper verbatim so dry-run and enforcement can never diverge (the shared-helper drift-control concern in phase-hooks-plan.md applies here with full force: a dry-run that disagrees with the guard is worse than none).

**Tests** (`test/sentinel.test.js`): `check` against an active sentinel reports DENY-with-reason for an out-of-list path and ALLOW for a listed one; against a missing/stale/malformed sentinel reports the fail-open reason; never exits non-zero; never modifies the sentinel file (assert mtime/content unchanged).

**Exit criteria.** A user with no sentinel knowledge can run one command and see exactly what the guards would do and why; README documents it in the enforcement section.

## R3. Visible, actionable denial messages

**Why.** RTK's retry loops came from the agent receiving an outcome it couldn't interpret, so it tried again blind. A Gantry guard denial must never be a bare non-zero exit: the agent needs the *reason and the remedy in-band* or it will burn turns rediscovering them. This is the gate-side mirror of llmtrim's one good idea (the visible `[… N lines omitted …]` marker).

**Change.** Both guards (file-list-guard, commit-guard) emit a single structured denial line on the channel the hook protocol surfaces to the model, naming: the active phase id, why this op was denied (path not in the phase's files list / commit blocked mid-phase), and the legitimate next step (report scope drift so the orchestrator runs `sentinel.js add-files`; or finish the phase and let review reach the `clear` point). Wording stays stable — treat the message as an interface; a test pins it.

**Tests** (`test/file-list-guard.test.js`, `test/commit-guard.test.js`): a denial's output contains the phase id, the offending path/command, and the remedy phrase; an allow stays silent (no noise on the happy path — same contract as sessionbrief's no-noise rule).

**Exit criteria.** No code path exits non-zero without the structured message; the message text is asserted, not just presence of output.

## R4. Adversarial input corpus for the guards

**Why.** Failure class #3. The phase-hooks tests cover the designed error paths; a public release needs the *hostile* ones — the inputs nobody designs for are exactly where a silent wrong-direction bug (deny what the writer authorized, or enforce nothing at all) would live undetected.

**Change.** New `test/guards-adversarial.test.js`, table-driven over the shared helper plus both guards. Corpus (extend as found, never trim): UNC paths (`\\server\share\repo\a.js`), drive-letter case variants, mixed separators, `..` escapes that resolve inside the root and ones that escape it, symlinked project root, unicode and spaces in paths, trailing separators, a files list of 1 entry and of 500 entries, malformed sentinel JSON (truncated mid-write, wrong types, future-shaped extra fields), an empty files list, and a sentinel whose `files` parse yields zero entries (the bare-paths template trap from deferred note 3). **Every row asserts the expected direction** — ALLOW because matched, ALLOW because fail-open (and which condition), or DENY — never just the exit code. A summary assertion counts fail-open rows so a future change that quietly widens fail-open coverage fails the suite.

**Tests.** The file is the deliverable; it must run in the standard `node --test` pass with no network, no fixtures outside `test/`.

**Exit criteria.** Corpus committed and green; every fail-open occurrence in the corpus maps to one of the enumerated error conditions from R1's test; a new contributor can add a row in one line.

## R5. Fail-open observability

**Why.** Fail-open is a hard invariant (phase-hooks-plan.md, cross-cutting concern 2) and stays one. But silent non-enforcement is failure class #2: if a bug makes a guard fail open on every call, today nothing would ever surface it — the hooks would simply not exist, invisibly, which is exactly how llmtrim's dead re-run rail shipped. Degrading safely and degrading *silently* are different properties; we keep the first and remove the second.

**Change.** When a guard allows *because of an error path* (as opposed to a genuine match or absent/inactive sentinel), it emits one stderr line — `gantry: guard fail-open (<condition>) on <tool>` — before exiting 0. Stderr only; must not alter the hook decision or the protocol-visible output (verify against the hook output contract confirmed in Phase 4 before choosing the channel; if stderr is surfaced to the model in this protocol, route to a `.gantry/guard.log` line instead and say so in the README — the requirement is *detectable*, not *loud*). Absent or not-opted-in sentinel stays fully silent: non-enforcement by configuration is not an error.

**Tests:** each fail-open row from R4 produces exactly one diagnostic line on the chosen channel; match/deny/not-opted-in paths produce none.

**Exit criteria.** A user can answer "did the guards actually run and enforce this session?" from the diagnostics alone; the no-noise contract holds for every non-error path.

## R6. README claims discipline + state/uninstall documentation

**Why.** Trust in a hook-loading plugin is set by what the README admits, not what it promises. The llmtrim audit found undocumented state (`~/.llmtrim`, a tracking DB) and headline numbers measured on the easy corpus; both cost the author credibility he had otherwise earned with reproducible benches. Gantry's equivalents must be written down before someone else finds them.

**Change.** `README.md` (gantry) gains, in the enforcement section or adjacent:
- **State inventory:** every file the plugin reads or writes and its lifecycle — `.gantry/active-phase.json` (transient, gitignored, never written except via `sentinel.js`), `.gantry/enabled` (committed opt-in marker), the `.gitignore` line init may append.
- **Uninstall:** one short block — remove the plugin, delete `.gantry/`, optionally drop the `.gitignore` line; after which nothing remains and no hook loads.
- **Limitations, stated plainly:** until R1 lands, the cross-platform path caveat (promoted from deferred note 1); the bare-paths template trap (deferred note 3) until the template fix ships; "hooks enforce file-list and commit gating only when opted in — everything else is contract plus the phase-reviewer" (the mechanical-vs-contract block from Phase 5, kept current).
- **Posture line:** zero dependencies, no network calls, no install scripts, fail-open by design — with a pointer to R2's `check` command as the way to verify rather than trust.

**Tests:** `test/consistency.test.js` continues to pass (README table/version sync); add an assertion that the README mentions every file path the scripts actually touch (greppable list kept next to the test).

**Exit criteria.** A skeptical reviewer can answer "what does it write, where, how do I see what it would do, how do I remove it completely" from the README alone.

## R7. Reproducible evidence over headline claims

**Why.** The part of the llmtrim author's posture worth copying: raw per-case results committed in-repo, reproduction in two commands. The part not to copy: the corpus contained only the shapes that worked. Gantry's evidence must include the hostile rows.

**Change.** The R4 corpus *is* the bench; make it presentable. A short `gantry/docs/guard-evidence.md` generated or hand-kept from the latest green run: the corpus table with expected vs observed direction per row, the suite's pass count, and the two commands to reproduce (`git clone …`, `node --test`). Update it whenever R4's corpus changes (the consistency test may pin the row count to keep it honest). No percentages, no aggregates — per-case rows only, hard cases included.

**Exit criteria.** A stranger can verify every enforcement claim in the README in under five minutes without trusting any number we publish.

## Ordering

R1 first (release blocker; everything else asserts against its enumerated fail-open conditions). R4 next (the corpus locks R1's behavior down). R2/R3/R5 in any order (independent; all reuse the Phase-1 helper). R6/R7 last, since they document what the code then provably does. Nothing here blocks or reorders the phase-hooks plan's Phase 4–5 work; R-items assume Phases 1–3 are merged.

## Out of scope (human decisions, do not attempt)

- Any guard that *rewrites* a tool call. Gate-don't-rewrite is permanent; this plan must never be cited to justify "fixing" an agent's input in flight.
- Marketplace/distribution mechanics (where the plugin is published, versioning cadence).
- Telemetry of any kind. Detectability (R5) is local-only by construction.

## Done means

All seven items' exit criteria met; `node --test` green from repo root on a POSIX host with zero platform-conditional skips; the two deferred notes promoted here (host-platform normalize, bare-paths template) are checked off in phase-hooks-plan.md with a pointer to this doc.
