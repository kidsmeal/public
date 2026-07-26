#!/usr/bin/env node
/*
 * sentinel.js - write, clear, and append to .gantry/active-phase.json.
 *
 * Subcommands:
 *   write <plan-path> <phase-number> [session-id]
 *       Read the named phase's Files list from the plan file, compute the
 *       allow-list (plan path + two scaffolded audit docs at docs/ or root +
 *       ROADMAP.md if present), stamp started (ISO) and session, and write the
 *       sentinel via fs. Overwrites any prior sentinel.
 *
 *   clear
 *       Remove .gantry/active-phase.json. No-op (no throw) when absent.
 *
 *   add-files <path> [<path>...]
 *       Append one or more paths to the active sentinel's files list,
 *       idempotently. No-op when no sentinel exists.
 *
 *   record-round <plan-path> <phase-number> <verdict>
 *       Append one review round (verdict + the required fixes piped on stdin)
 *       to .gantry/review-round.json, for role.js to relay as re-review
 *       context. A round file for a different plan or phase is replaced, so
 *       another phase's rounds can never leak into this phase's context.
 *
 * The review-round file shares the sentinel's lifecycle: `write` for a
 * DIFFERENT plan/phase removes it (a fresh phase starts with no prior rounds;
 * a re-write for the same phase - the /gantry:build fix-relay path - keeps
 * it), and `clear` always removes it.
 *
 * These files are ONLY written/removed by this script (invoked over Bash by
 * the orchestrator). They are never written or removed via a tool op
 * (Edit/Write/rm), which preserves the deadlock-avoidance property: the
 * file-list guard matches Edit|Write|MultiEdit (not Bash), and the
 * commit-guard only denies git commit/push, so a `node sentinel.js` Bash call
 * passes both guards untouched.
 *
 * Path normalization reuses sentinel-core.js so the write side and read side
 * (the guards) cannot drift on path interpretation.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const { resolveRoot, normalize } = require("./sentinel-core.js");

const ROOT = resolveRoot(process.env);
const SENTINEL_PATH = path.join(ROOT, ".gantry", "active-phase.json");
const ROUND_PATH = path.join(ROOT, ".gantry", "review-round.json");

// ---------------------------------------------------------------------------
// Plan parsing
// ---------------------------------------------------------------------------

// Parse the Files: list for a given phase number from plan text.
// Returns an array of repo-relative POSIX paths, in order.
//
// Handles TWO canonical formats:
//
//   INLINE (PLAN.md template canonical shape):
//     **Files:** `path/to/file.js`, `path/to/other.js`
//
//   BULLET (phase-hooks-plan.md and most real plans):
//     **Files:**
//     - create `path/to/file.js` (optional description)
//     - modify `path/to/other.js`: optional description
//     - modify `path/one.js`, `path/two.js` (both changed together)
//
// The inline form is extracted from the **Files:** line itself. Each bullet
// contributes its LEADING run of comma-separated backtick-quoted paths (see
// extractLeadingBacktickRun), so a multi-file bullet contributes every file
// it names, while backtick-quoted identifiers in a trailing description
// (constants, function names, section names) are not swept in. Capturing
// only the first token per bullet silently underscoped every multi-file
// phase - found live by a codex phase review running the real plan.
//
// Returns an empty array if the phase or Files section is not found.
// Callers MUST treat an empty return as a fatal error (fail-open; do not
// write a sentinel with an empty scope).

// The leading run of comma-separated backtick-quoted tokens on a bullet
// line: `a`, `b`, `c` (description...) yields [a, b, c] and stops at the
// first gap between tokens that is not exactly a comma separator, so a
// trailing description's own backtick-quoted identifiers ("- modify `x.js`
// (`SOME_CONST`; add `helper`)" must yield only `x.js`).
function extractLeadingBacktickRun(line) {
  const tokens = [];
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    tokens.push({ text: m[1], start: m.index, end: m.index + m[0].length });
  }
  if (tokens.length === 0) return [];
  const run = [tokens[0].text];
  for (let i = 1; i < tokens.length; i++) {
    const between = line.slice(tokens[i - 1].end, tokens[i].start);
    if (!/^,\s*$/.test(between)) break;
    run.push(tokens[i].text);
  }
  return run;
}

function parsePhaseFiles(planText, phaseNumber) {
  const lines = planText.split("\n");
  const phaseRe = new RegExp("^##\\s+Phase\\s+" + phaseNumber + "[^0-9]");
  const filesHeadRe = /^\*\*Files:\*\*/;
  const nextSectionRe = /^(##\s|\*\*)/;

  // 1. Find the phase heading line.
  let phaseIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (phaseRe.test(lines[i])) { phaseIdx = i; break; }
  }
  if (phaseIdx === -1) return [];

  // 2. Find the **Files:** line within this phase.
  let filesIdx = -1;
  for (let i = phaseIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break; // reached the next phase heading - stop
    if (filesHeadRe.test(lines[i])) { filesIdx = i; break; }
  }
  if (filesIdx === -1) return [];

  const files = [];

  // 3a. INLINE format: extract all backtick-wrapped tokens from the **Files:**
  //     line itself (everything after "**Files:**").
  //     E.g. "**Files:** `src/a.js`, `src/b.js`" -> ["src/a.js", "src/b.js"]
  const filesLine = lines[filesIdx];
  const inlinePart = filesLine.replace(/^\*\*Files:\*\*/, "");
  const inlineRe = /`([^`]+)`/g;
  let m;
  while ((m = inlineRe.exec(inlinePart)) !== null) {
    files.push(m[1]);
  }

  // 3b. BULLET format: collect `- ` lines that follow until the next bold
  //     heading or ## heading. Each bullet contributes its leading run of
  //     comma-separated backtick-quoted paths, never just the first.
  for (let i = filesIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (nextSectionRe.test(line)) break;
    if (!/^-\s/.test(line)) continue;
    for (const f of extractLeadingBacktickRun(line)) files.push(f);
  }

  return files;
}

// ---------------------------------------------------------------------------
// Allow-list computation
// ---------------------------------------------------------------------------

// Compute the allow-list for a sentinel given the plan path and project root.
// Mirrors init.js's docDir logic: audit docs go in docs/ if it exists, else root.
// Also includes ROADMAP.md only when that file actually exists at the project root.
function computeAllow(planAbsPath) {
  // Normalize the plan path to a root-relative POSIX string.
  const planRel = _toRelPosix(planAbsPath);

  // docDir: "docs" if docs/ exists under ROOT, else "." (root)
  const docsExists = _exists(path.join(ROOT, "docs"));
  const docDir = docsExists ? "docs" : ".";

  const auditDocs = [
    "CURRENTNESS_AUDIT.md",
    "RUNTIME_VERIFICATION_QUEUE.md",
  ].map((name) => {
    const rel = docDir === "." ? name : docDir + "/" + name;
    return rel;
  });

  const allow = [planRel, ...auditDocs];

  // ROADMAP.md only when it actually exists at the project root.
  if (_exists(path.join(ROOT, "ROADMAP.md"))) {
    allow.push("ROADMAP.md");
  }

  return allow;
}

// Convert an absolute path to a root-relative POSIX string, using normalize()
// from sentinel-core so both sides use identical logic. Falls back to a best-
// effort path.join-based relative if normalize returns FAIL_OPEN (should not
// happen for valid plan paths under ROOT, but we must not throw).
const { FAIL_OPEN } = require("./sentinel-core.js");
function _toRelPosix(absPath) {
  const result = normalize(absPath, ROOT);
  if (result === FAIL_OPEN) {
    // Fallback: compute relative path manually, convert separators.
    return path.relative(ROOT, absPath).replace(/\\/g, "/");
  }
  return result;
}

function _exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

// Read .gantry/active-phase.json, or null when absent/malformed.
function _readSentinelFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(SENTINEL_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Review-round file helpers
// ---------------------------------------------------------------------------

// Read .gantry/review-round.json, or null when absent/malformed. The round
// file is advisory context, so any damage reads as "no rounds recorded".
function _readRoundFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(ROUND_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

// Remove the review-round file. Never fatal: round context is advisory and
// must not block the phase lifecycle commands that call this.
function _clearRoundFile() {
  try {
    fs.unlinkSync(ROUND_PATH);
  } catch (e) {
    if (e.code !== "ENOENT") {
      process.stderr.write("sentinel.js: could not remove review-round.json: " + e.message + "\n");
    }
  }
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

function cmdWrite(args) {
  const planArg = args[0];
  const phaseArg = args[1];
  const sessionArg = args[2];

  if (!planArg || !phaseArg) {
    console.error("sentinel.js write: usage: write <plan-path> <phase-number> [session-id]");
    process.exit(1);
  }

  const phaseNumber = parseInt(phaseArg, 10);
  if (isNaN(phaseNumber)) {
    console.error("sentinel.js write: phase-number must be an integer, got: " + phaseArg);
    process.exit(1);
  }

  // Resolve the plan path relative to ROOT if it is not absolute.
  const planAbsPath = path.isAbsolute(planArg) ? planArg : path.join(ROOT, planArg);

  let planText;
  try {
    planText = fs.readFileSync(planAbsPath, "utf8");
  } catch (e) {
    console.error("sentinel.js write: cannot read plan file " + planAbsPath + ": " + e.message);
    process.exit(1);
  }

  const files = parsePhaseFiles(planText, phaseNumber);

  // Zero files = fail-open: do NOT write a sentinel with an empty scope.
  // An empty files[] would cause the guard to deny every Edit/Write (fail-CLOSED),
  // which is the cardinal sin. Print a clear diagnostic and exit non-zero so the
  // caller knows no sentinel was written and the phase runs unguarded.
  if (files.length === 0) {
    process.stderr.write(
      "sentinel: could not parse any files from phase " + phaseNumber +
      " of " + planAbsPath + "; not writing sentinel\n"
    );
    process.exit(1);
  }

  const allow = computeAllow(planAbsPath);

  // Session: explicit arg > GANTRY_SESSION_ID (explicit override) >
  // CLAUDE_CODE_SESSION_ID (the real env var Claude Code injects into Bash
  // hooks; it holds the same UUID the PreToolUse stdin delivers as session_id,
  // which is what the staleness check in the guard compares against) > "".
  const session = sessionArg ||
    process.env.GANTRY_SESSION_ID ||
    process.env.CLAUDE_CODE_SESSION_ID ||
    "";

  const planRel = _toRelPosix(planAbsPath);

  // An existing sentinel for the SAME plan+phase is the /gantry:build
  // fix-relay path re-running write mid-review-loop: any paths the review
  // step widened in via add-files (reviewer-cited files outside the plan's
  // Files list) must survive, or the fix pass gets denied edits to exactly
  // the files it was sent to fix. A sentinel for a different plan or phase
  // is a fresh start and its widening does not carry over.
  const existing = _readSentinelFile();
  if (existing && existing.plan === planRel && existing.phase === phaseNumber &&
      Array.isArray(existing.files)) {
    for (const p of existing.files) {
      if (typeof p === "string" && !files.includes(p)) files.push(p);
    }
  }

  const sentinel = {
    plan: planRel,
    phase: phaseNumber,
    files,
    allow,
    started: new Date().toISOString(),
    session,
  };

  try {
    fs.mkdirSync(path.join(ROOT, ".gantry"), { recursive: true });
    fs.writeFileSync(SENTINEL_PATH, JSON.stringify(sentinel, null, 2) + "\n", "utf8");
  } catch (e) {
    console.error("sentinel.js write: cannot write sentinel: " + e.message);
    process.exit(1);
  }

  // A recorded review-round file for a DIFFERENT plan or phase is stale - a
  // fresh phase must start with no prior-round context. Same plan+phase is the
  // /gantry:build fix-relay path re-running write mid-review-loop; its rounds
  // are live and must survive, or the re-review loses exactly the context this
  // file exists to carry.
  const round = _readRoundFile();
  if (round && (round.plan !== planRel || round.phase !== phaseNumber)) {
    _clearRoundFile();
  }

  console.log("sentinel.js: wrote phase " + phaseNumber + " sentinel (" + files.length + " file(s) in scope)");
}

function cmdClear() {
  // The phase is closing: any recorded review rounds die with it.
  _clearRoundFile();
  try {
    fs.unlinkSync(SENTINEL_PATH);
    console.log("sentinel.js: cleared active-phase.json");
  } catch (e) {
    // ENOENT means the file was already absent - that is the desired state.
    if (e.code !== "ENOENT") {
      console.error("sentinel.js clear: unexpected error: " + e.message);
      process.exit(1);
    }
    // No-op for absent sentinel - exit 0 silently.
  }
}

function cmdAddFiles(args) {
  if (args.length === 0) {
    // Nothing to add; no-op.
    return;
  }

  // Read the active sentinel; no-op if absent.
  let sentinel;
  try {
    const raw = fs.readFileSync(SENTINEL_PATH, "utf8");
    sentinel = JSON.parse(raw);
  } catch {
    // Absent or malformed - no-op.
    return;
  }

  if (!Array.isArray(sentinel.files)) sentinel.files = [];

  let added = 0;
  for (const p of args) {
    if (!sentinel.files.includes(p)) {
      sentinel.files.push(p);
      added++;
    }
  }

  if (added > 0) {
    try {
      fs.writeFileSync(SENTINEL_PATH, JSON.stringify(sentinel, null, 2) + "\n", "utf8");
      console.log("sentinel.js: added " + added + " path(s) to sentinel files");
    } catch (e) {
      console.error("sentinel.js add-files: cannot write sentinel: " + e.message);
      process.exit(1);
    }
  }
}

function cmdRecordRound(args) {
  const planArg = args[0];
  const phaseArg = args[1];
  const verdict = args[2];

  if (!planArg || !phaseArg || !verdict) {
    console.error(
      "sentinel.js record-round: usage: record-round <plan-path> <phase-number> <verdict>" +
      "  (pipe the required fixes on stdin)"
    );
    process.exit(1);
  }

  const phaseNumber = parseInt(phaseArg, 10);
  if (isNaN(phaseNumber)) {
    console.error("sentinel.js record-round: phase-number must be an integer, got: " + phaseArg);
    process.exit(1);
  }

  let fixes = "";
  try { fixes = fs.readFileSync(0, "utf8"); } catch { /* no stdin */ }
  fixes = fixes.trim();
  // A round with no fixes text is useless context - refuse it loudly so the
  // caller re-runs with the reviewer's actual Required fixes piped in.
  if (!fixes) {
    console.error(
      "sentinel.js record-round: no fixes text on stdin - pipe the reviewer's" +
      " Required fixes (or Fix-now notes) verbatim."
    );
    process.exit(1);
  }

  const planAbsPath = path.isAbsolute(planArg) ? planArg : path.join(ROOT, planArg);
  const planRel = _toRelPosix(planAbsPath);

  // Rounds accumulate for the same plan+phase; anything else (different phase,
  // absent, malformed) starts a fresh file, so stale rounds never leak.
  let state = _readRoundFile();
  if (
    !state || state.plan !== planRel || state.phase !== phaseNumber ||
    !Array.isArray(state.rounds)
  ) {
    state = { plan: planRel, phase: phaseNumber, rounds: [] };
  }

  state.rounds.push({
    round: state.rounds.length + 1,
    verdict,
    fixes,
    recorded: new Date().toISOString(),
  });

  try {
    fs.mkdirSync(path.join(ROOT, ".gantry"), { recursive: true });
    fs.writeFileSync(ROUND_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
  } catch (e) {
    console.error("sentinel.js record-round: cannot write review-round.json: " + e.message);
    process.exit(1);
  }

  console.log(
    "sentinel.js: recorded review round " + state.rounds.length +
    " (" + verdict + ") for phase " + phaseNumber
  );
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const [,, subcommand, ...rest] = process.argv;

switch (subcommand) {
  case "write":
    cmdWrite(rest);
    break;
  case "clear":
    cmdClear();
    break;
  case "add-files":
    cmdAddFiles(rest);
    break;
  case "record-round":
    cmdRecordRound(rest);
    break;
  default:
    console.error(
      "sentinel.js: unknown subcommand: " + subcommand + "\n" +
      "Usage:\n" +
      "  sentinel.js write <plan-path> <phase-number> [session-id]\n" +
      "  sentinel.js clear\n" +
      "  sentinel.js add-files <path> [<path>...]\n" +
      "  sentinel.js record-round <plan-path> <phase-number> <verdict>  (fixes on stdin)\n"
    );
    process.exit(1);
}
