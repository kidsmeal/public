"use strict";
/* Tests for sentinel.js - write / clear / add-files subcommands. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SENTINEL_SCRIPT = path.join(__dirname, "..", "plugins", "gantry", "scripts", "sentinel.js");

// A minimal plan fixture with two phases, used across most tests.
// Phase 2 has two Files entries; phase 3 has one.
const FIXTURE_PLAN = `# Test Plan
Source design: docs/design.md
Conventions read: none
Verification command(s): node --test

## Summary
Fixture plan for sentinel.test.js.

## Blockers / Open Questions
None.

## Phase 2: test phase two
**Goal:** Test phase two goal.
**Files:**
- create \`src/foo.js\` (some description)
- modify \`src/bar.js\`: some description
**Verification:** node --test
**Exit criteria:** tests pass.
**Blockers:** None.

## Phase 3: test phase three
**Goal:** Test phase three goal.
**Files:**
- create \`lib/baz.js\`
**Verification:** node --test
**Exit criteria:** tests pass.
**Blockers:** None.

## Cross-cutting concerns
None.
`;

function mk() { return fs.mkdtempSync(path.join(os.tmpdir(), "gantry-sent-")); }
function write(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function readSentinel(dir) {
  const p = path.join(dir, ".gantry", "active-phase.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function sentinelExists(dir) {
  return fs.existsSync(path.join(dir, ".gantry", "active-phase.json"));
}

// Run sentinel.js with the given args and a GANTRY_PROJECT_DIR pointing at dir.
// planPath defaults to a temp plan file in dir when not specified.
function run(dir, args, extraEnv) {
  return spawnSync(process.execPath, [SENTINEL_SCRIPT, ...args], {
    encoding: "utf8",
    env: { ...process.env, GANTRY_PROJECT_DIR: dir, ...extraEnv },
  });
}

// Write the fixture plan into dir and return its absolute path.
function writePlan(dir) {
  const planPath = path.join(dir, "docs", "plan.md");
  write(dir, "docs/plan.md", FIXTURE_PLAN);
  return planPath;
}

// --- write subcommand: files list ---

test("write: files list equals the plan phase's Files entries", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    const r = run(dir, ["write", planPath, "2"]);
    assert.equal(r.status, 0, "write should exit 0\nstdout: " + r.stdout + "\nstderr: " + r.stderr);
    const s = readSentinel(dir);
    assert.deepEqual(s.files, ["src/foo.js", "src/bar.js"],
      "files should match the two entries in Phase 2 Files");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("write: files list for a different phase number", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    const r = run(dir, ["write", planPath, "3"]);
    assert.equal(r.status, 0, r.stderr);
    const s = readSentinel(dir);
    assert.deepEqual(s.files, ["lib/baz.js"], "files should match Phase 3 Files");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- write: INLINE Files format (canonical PLAN.md template shape) ---

// A plan fixture that uses the canonical INLINE **Files:** format where paths
// sit on the same line as the heading, not in bullet lines below it.
const INLINE_PLAN = `# Inline Plan
Source design: docs/design.md
Conventions read: none
Verification command(s): node --test

## Summary
Plan with inline Files format.

## Blockers / Open Questions
None.

## Phase 1: inline phase
**Status:** pending
**Goal:** Test inline Files parsing.
**Files:** \`src/alpha.js\`, \`src/beta.js\`
**Verification:** node --test
**Exit criteria:** tests pass.
**Blockers:** None.

## Cross-cutting concerns
None.
`;

test("write: parses inline Files format (paths on the **Files:** line itself)", () => {
  const dir = mk();
  try {
    const planPath = path.join(dir, "plan.md");
    fs.writeFileSync(planPath, INLINE_PLAN);
    const r = run(dir, ["write", planPath, "1"]);
    assert.equal(r.status, 0, "write should exit 0 for inline Files format\nstderr: " + r.stderr);
    const s = readSentinel(dir);
    assert.deepEqual(s.files, ["src/alpha.js", "src/beta.js"],
      "files should match the two inline backtick-quoted tokens on the **Files:** line");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// A plan fixture with no backtick-quoted paths - simulates a phase where the
// parser cannot extract any file paths (e.g. missing backticks, prose-only Files).
const NO_FILES_PLAN = `# No Files Plan
Source design: docs/design.md
Conventions read: none
Verification command(s): node --test

## Summary
Plan with no parseable file paths.

## Phase 1: empty files phase
**Goal:** Phase with no parseable files.
**Files:** (see design doc for full list)
**Verification:** node --test
**Exit criteria:** tests pass.
**Blockers:** None.

## Cross-cutting concerns
None.
`;

test("write: exits non-zero and writes NO sentinel when phase yields zero parseable files", () => {
  const dir = mk();
  try {
    const planPath = path.join(dir, "plan.md");
    fs.writeFileSync(planPath, NO_FILES_PLAN);
    const r = run(dir, ["write", planPath, "1"]);
    assert.notEqual(r.status, 0,
      "write must exit non-zero when no files can be parsed (fail-open: do not write broken sentinel)");
    assert.ok(!sentinelExists(dir),
      "no sentinel file should be written when zero files were parsed");
    assert.ok(r.stderr.includes("could not parse any files"),
      "stderr should contain the diagnostic message; got: " + r.stderr);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- write subcommand: allow list - docs/ vs root ---

test("write: allow resolves audit docs into docs/ when docs/ exists", () => {
  const dir = mk();
  try {
    // docs/ already exists (we wrote the plan there)
    const planPath = writePlan(dir);
    const r = run(dir, ["write", planPath, "2"]);
    assert.equal(r.status, 0, r.stderr);
    const s = readSentinel(dir);
    // Plan path itself should be in allow (relative to root)
    assert.ok(s.allow.includes("docs/plan.md"), "allow should include the plan path (docs/plan.md)");
    // Audit docs should be in docs/
    assert.ok(s.allow.includes("docs/CURRENTNESS_AUDIT.md"),
      "allow should include docs/CURRENTNESS_AUDIT.md when docs/ exists");
    assert.ok(s.allow.includes("docs/RUNTIME_VERIFICATION_QUEUE.md"),
      "allow should include docs/RUNTIME_VERIFICATION_QUEUE.md when docs/ exists");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("write: allow resolves audit docs to root when docs/ is absent", () => {
  const dir = mk();
  try {
    // Write the plan at the root level (no docs/ dir)
    const planPath = path.join(dir, "plan.md");
    fs.writeFileSync(planPath, FIXTURE_PLAN);
    const r = run(dir, ["write", planPath, "2"]);
    assert.equal(r.status, 0, r.stderr);
    const s = readSentinel(dir);
    // Plan path at root
    assert.ok(s.allow.includes("plan.md"), "allow should include plan.md (root)");
    // Audit docs at root
    assert.ok(s.allow.includes("CURRENTNESS_AUDIT.md"),
      "allow should include CURRENTNESS_AUDIT.md at root when docs/ is absent");
    assert.ok(s.allow.includes("RUNTIME_VERIFICATION_QUEUE.md"),
      "allow should include RUNTIME_VERIFICATION_QUEUE.md at root when docs/ is absent");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- write subcommand: ROADMAP.md ---

test("write: ROADMAP.md included in allow only when the file exists", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);

    // Without ROADMAP.md
    const r1 = run(dir, ["write", planPath, "2"]);
    assert.equal(r1.status, 0, r1.stderr);
    const s1 = readSentinel(dir);
    assert.ok(!s1.allow.includes("ROADMAP.md"), "allow must NOT include ROADMAP.md when file is absent");

    // With ROADMAP.md present
    write(dir, "ROADMAP.md", "# Roadmap\n");
    const r2 = run(dir, ["write", planPath, "2"]);
    assert.equal(r2.status, 0, r2.stderr);
    const s2 = readSentinel(dir);
    assert.ok(s2.allow.includes("ROADMAP.md"), "allow MUST include ROADMAP.md when file exists");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- write subcommand: metadata stamping ---

test("write: stamps started as ISO string and plan/phase fields", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    const before = new Date();
    const r = run(dir, ["write", planPath, "2"]);
    const after = new Date();
    assert.equal(r.status, 0, r.stderr);
    const s = readSentinel(dir);
    assert.equal(s.phase, 2, "phase should be 2");
    const started = new Date(s.started);
    assert.ok(started >= before && started <= after, "started should be within the test window");
    // plan field should be the relative path of the plan from the project root
    assert.equal(s.plan, "docs/plan.md", "plan field should be relative path");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("write: session stamped from third argument when provided", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    const r = run(dir, ["write", planPath, "2", "my-session-123"]);
    assert.equal(r.status, 0, r.stderr);
    const s = readSentinel(dir);
    assert.equal(s.session, "my-session-123");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("write: session stamped from GANTRY_SESSION_ID env when no arg provided", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    const r = run(dir, ["write", planPath, "2"], { GANTRY_SESSION_ID: "env-session-456" });
    assert.equal(r.status, 0, r.stderr);
    const s = readSentinel(dir);
    assert.equal(s.session, "env-session-456");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("write: session stamped from CLAUDE_CODE_SESSION_ID when no arg and no GANTRY_SESSION_ID", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    // Unset GANTRY_SESSION_ID explicitly so we fall through to CLAUDE_CODE_SESSION_ID.
    const envOverride = { CLAUDE_CODE_SESSION_ID: "cc-session-789" };
    // spawnSync inherits process.env via run(); override GANTRY_SESSION_ID to empty.
    const r = run(dir, ["write", planPath, "2"], { ...envOverride, GANTRY_SESSION_ID: "" });
    assert.equal(r.status, 0, "write with CLAUDE_CODE_SESSION_ID should exit 0\nstderr: " + r.stderr);
    const s = readSentinel(dir);
    assert.equal(s.session, "cc-session-789",
      "session should equal CLAUDE_CODE_SESSION_ID when no explicit arg or GANTRY_SESSION_ID");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- write overwrites prior sentinel (single-writer property) ---

test("write: second write overwrites a prior sentinel", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);

    run(dir, ["write", planPath, "2", "session-a"]);
    const first = readSentinel(dir);
    assert.equal(first.phase, 2);
    assert.equal(first.session, "session-a");

    run(dir, ["write", planPath, "3", "session-b"]);
    const second = readSentinel(dir);
    assert.equal(second.phase, 3, "second write should overwrite to phase 3");
    assert.equal(second.session, "session-b", "second write should overwrite session");
    assert.deepEqual(second.files, ["lib/baz.js"], "second write should overwrite files");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- clear subcommand ---

test("clear: removes the sentinel file", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    run(dir, ["write", planPath, "2"]);
    assert.ok(sentinelExists(dir), "sentinel should exist before clear");
    const r = run(dir, ["clear"]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!sentinelExists(dir), "sentinel should be removed after clear");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("clear: no-op (no throw, exit 0) when sentinel is absent", () => {
  const dir = mk();
  try {
    assert.ok(!sentinelExists(dir), "no sentinel should pre-exist");
    const r = run(dir, ["clear"]);
    assert.equal(r.status, 0, "clear on absent sentinel must exit 0\nstdout: " + r.stdout + "\nstderr: " + r.stderr);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- add-files subcommand ---

test("add-files: appends new paths to the sentinel's files list", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    run(dir, ["write", planPath, "2"]);
    const r = run(dir, ["add-files", "src/extra.js", "lib/helper.js"]);
    assert.equal(r.status, 0, r.stderr);
    const s = readSentinel(dir);
    assert.ok(s.files.includes("src/extra.js"), "src/extra.js should be appended");
    assert.ok(s.files.includes("lib/helper.js"), "lib/helper.js should be appended");
    // Original entries still present
    assert.ok(s.files.includes("src/foo.js"), "original src/foo.js should remain");
    assert.ok(s.files.includes("src/bar.js"), "original src/bar.js should remain");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("add-files: idempotent - does not duplicate an already-listed path", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    run(dir, ["write", planPath, "2"]);
    // src/foo.js is already in files from the plan
    const r = run(dir, ["add-files", "src/foo.js", "src/new.js"]);
    assert.equal(r.status, 0, r.stderr);
    const s = readSentinel(dir);
    const count = s.files.filter((f) => f === "src/foo.js").length;
    assert.equal(count, 1, "src/foo.js should appear exactly once (no duplicate)");
    assert.ok(s.files.includes("src/new.js"), "src/new.js should be added");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("add-files: no-op (no throw, exit 0) when sentinel is absent", () => {
  const dir = mk();
  try {
    assert.ok(!sentinelExists(dir), "no sentinel should pre-exist");
    const r = run(dir, ["add-files", "src/extra.js"]);
    assert.equal(r.status, 0, "add-files on absent sentinel must exit 0\nstdout: " + r.stdout + "\nstderr: " + r.stderr);
    assert.ok(!sentinelExists(dir), "no sentinel should be created");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Regression for the fix-relay widening bug: /gantry:review relays a FAIL by
// running add-files with the reviewer's cited paths, then /gantry:build re-runs
// `write` for the same plan+phase before spawning the fix pass. That write must
// keep the widened paths, or the fix pass is denied edits to the very files the
// reviewer cited.

test("write: same plan+phase re-write keeps paths widened via add-files", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    run(dir, ["write", planPath, "2"]);
    // Widen with a path that is NOT in Phase 2's Files list.
    run(dir, ["add-files", "src/cited-by-reviewer.js"]);
    const r = run(dir, ["write", planPath, "2"]);
    assert.equal(r.status, 0, r.stderr);
    const s = readSentinel(dir);
    assert.ok(s.files.includes("src/cited-by-reviewer.js"),
      "add-files widening must survive a same-phase re-write");
    // Plan files still present, and merge stays idempotent (no duplicates).
    assert.deepEqual(s.files, ["src/foo.js", "src/bar.js", "src/cited-by-reviewer.js"],
      "files should be the plan's entries plus the widened path, no duplicates");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("write: different phase drops paths widened via add-files", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    run(dir, ["write", planPath, "2"]);
    run(dir, ["add-files", "src/cited-by-reviewer.js"]);
    const r = run(dir, ["write", planPath, "3"]);
    assert.equal(r.status, 0, r.stderr);
    const s = readSentinel(dir);
    assert.deepEqual(s.files, ["lib/baz.js"],
      "a new phase must start clean, dropping prior-phase widening");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Regression for the multi-file-per-bullet bug (found live by a codex phase
// review running a real plan): a bullet like "- modify `a.js`, `b.js`, `c.js`"
// must contribute all three files, not just the first, while backtick-quoted
// identifiers in a trailing description must NOT be swept in.
const MULTI_FILE_PLAN = `# Multi Plan
Source design: docs/design.md
Conventions read: none
Verification command(s): node --test

## Summary
Fixture plan with multi-file bullets.

## Phase 2: multi-file phase
**Goal:** Test multi-file Files bullets.
**Files:**
- modify \`a.js\`, \`b.js\`, \`c.js\` (three files, one bullet)
- modify \`d.js\` (\`SOME_CONST = 1\`; add \`helperFn\` and \`otherThing\` - description text, not file paths)
- create \`e.js\`, \`f.js\`
**Verification:** node --test
**Exit criteria:** tests pass.
**Blockers:** None.

## Cross-cutting concerns
None.
`;

test("write: a bullet with multiple comma-separated backtick paths contributes every path", () => {
  const dir = mk();
  try {
    const planPath = path.join(dir, "plan.md");
    fs.writeFileSync(planPath, MULTI_FILE_PLAN);
    const r = run(dir, ["write", planPath, "2"]);
    assert.equal(r.status, 0, "write should exit 0\nstdout: " + r.stdout + "\nstderr: " + r.stderr);
    const s = readSentinel(dir);
    assert.deepEqual(
      s.files,
      ["a.js", "b.js", "c.js", "d.js", "e.js", "f.js"],
      "every backtick-quoted path across all bullets must be captured, in order"
    );
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- record-round subcommand: re-review context rounds ---

// Like run(), but with stdin content (the fixes text record-round expects).
function runIn(dir, args, input) {
  return spawnSync(process.execPath, [SENTINEL_SCRIPT, ...args], {
    encoding: "utf8",
    input,
    env: { ...process.env, GANTRY_PROJECT_DIR: dir },
  });
}
function readRounds(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, ".gantry", "review-round.json"), "utf8"));
}
function roundsExist(dir) {
  return fs.existsSync(path.join(dir, ".gantry", "review-round.json"));
}

test("record-round: creates review-round.json with round 1 from stdin fixes", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    const r = runIn(dir, ["record-round", planPath, "2", "FAIL"], "1. fix the thing\n2. fix the other thing\n");
    assert.equal(r.status, 0, "record-round should exit 0\nstdout: " + r.stdout + "\nstderr: " + r.stderr);
    const s = readRounds(dir);
    assert.equal(s.plan, "docs/plan.md", "plan must be stored root-relative posix");
    assert.equal(s.phase, 2);
    assert.equal(s.rounds.length, 1);
    assert.equal(s.rounds[0].round, 1);
    assert.equal(s.rounds[0].verdict, "FAIL");
    assert.match(s.rounds[0].fixes, /fix the thing/);
    assert.ok(s.rounds[0].recorded, "round must carry a recorded timestamp");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("record-round: appends round 2 for the same plan and phase", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    runIn(dir, ["record-round", planPath, "2", "FAIL"], "round one fixes");
    const r = runIn(dir, ["record-round", planPath, "2", "PASS-WITH-NOTES"], "round two fixes");
    assert.equal(r.status, 0, r.stderr);
    const s = readRounds(dir);
    assert.equal(s.rounds.length, 2, "rounds must accumulate for the same plan+phase");
    assert.equal(s.rounds[1].round, 2);
    assert.equal(s.rounds[1].verdict, "PASS-WITH-NOTES");
    assert.match(s.rounds[1].fixes, /round two fixes/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("record-round: a different phase starts a fresh file (no cross-phase leak)", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    runIn(dir, ["record-round", planPath, "2", "FAIL"], "phase two fixes");
    const r = runIn(dir, ["record-round", planPath, "3", "FAIL"], "phase three fixes");
    assert.equal(r.status, 0, r.stderr);
    const s = readRounds(dir);
    assert.equal(s.phase, 3);
    assert.equal(s.rounds.length, 1, "prior phase's rounds must be discarded");
    assert.match(s.rounds[0].fixes, /phase three fixes/);
    assert.doesNotMatch(JSON.stringify(s), /phase two fixes/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("record-round: empty stdin exits non-zero and writes nothing", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    const r = runIn(dir, ["record-round", planPath, "2", "FAIL"], "");
    assert.notEqual(r.status, 0, "a round with no fixes text must be refused");
    assert.match(r.stderr, /stdin/i, "the error must say the fixes go on stdin");
    assert.ok(!roundsExist(dir), "no round file should be written");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("record-round: missing args exit non-zero with usage", () => {
  const dir = mk();
  try {
    const r = runIn(dir, ["record-round", "plan.md", "2"], "fixes");
    assert.notEqual(r.status, 0, "record-round without a verdict must fail");
    assert.match(r.stderr, /usage/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("write: removes a stale round file recorded for a different phase", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    runIn(dir, ["record-round", planPath, "2", "FAIL"], "phase two fixes");
    assert.ok(roundsExist(dir));
    const r = run(dir, ["write", planPath, "3"]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!roundsExist(dir),
      "starting phase 3 must remove phase 2's recorded rounds");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("write: keeps the round file for the same plan and phase (the fix-relay path)", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    run(dir, ["write", planPath, "2"]);
    runIn(dir, ["record-round", planPath, "2", "FAIL"], "mid-loop fixes");
    // /gantry:build re-invoked for the fix pass runs write again for the SAME
    // plan+phase; the live rounds must survive or the re-review loses its context.
    const r = run(dir, ["write", planPath, "2"]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(roundsExist(dir), "same-phase re-write must keep the recorded rounds");
    assert.match(readRounds(dir).rounds[0].fixes, /mid-loop fixes/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("clear: removes the round file along with the sentinel", () => {
  const dir = mk();
  try {
    const planPath = writePlan(dir);
    run(dir, ["write", planPath, "2"]);
    runIn(dir, ["record-round", planPath, "2", "FAIL"], "some fixes");
    const r = run(dir, ["clear"]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!sentinelExists(dir), "sentinel must be cleared");
    assert.ok(!roundsExist(dir), "recorded rounds die with the phase");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
