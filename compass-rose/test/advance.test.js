"use strict";
/*
 * Tests for advance.js (the deterministic dispatcher) and setFields() in roadmap.js.
 * advance.js tests use spawnSync with temp dirs (same pattern as the other compass tests).
 * setFields tests require roadmap.js directly for speed.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ADVANCE = path.join(__dirname, "..", "plugins", "compass", "scripts", "advance.js");
const { setFields } = require(path.join(__dirname, "..", "plugins", "compass", "scripts", "roadmap.js"));

function mk() { return fs.mkdtempSync(path.join(os.tmpdir(), "compass-advance-")); }
function write(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function run(dir, extraArgs) {
  return spawnSync(process.execPath, [ADVANCE, ...(extraArgs || [])], {
    encoding: "utf8",
    env: { ...process.env, COMPASS_PROJECT_DIR: dir, CLAUDE_PROJECT_DIR: dir },
  });
}
function roadmap(dir, content) { write(dir, "docs/ROADMAP.md", content); }

// Creates a minimal git repo with one commit (clean tree). Pass dirty=true to
// leave an uncommitted file so the tree reads as dirty.
function mkGitRepo(dirty) {
  const dir = mk();
  const git = (args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git(["init", "-q"]);
  git(["config", "user.email", "test@test.com"]);
  git(["config", "user.name", "Test"]);
  write(dir, "README.md", "# test");
  git(["add", "README.md"]);
  git(["-c", "commit.gpgsign=false", "commit", "-qm", "init"]);
  if (dirty) write(dir, "src/work.js", "// uncommitted change");
  return dir;
}
function row(fields) {
  const lines = ["## Now", "- [ ] My Feature  <!-- id: my-feature -->"];
  for (const [k, v] of Object.entries(fields)) lines.push("  - " + k + ": " + v);
  return lines.join("\n");
}

// --- Decision table ---

test("idea status -> PROMOTE, HUMAN DECISION REQUIRED", () => {
  const dir = mk();
  try {
    roadmap(dir, row({ status: "idea" }));
    const out = run(dir).stdout;
    assert.match(out, /PROMOTE/);
    assert.match(out, /HUMAN DECISION REQUIRED/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("designing status -> PROMOTE, HUMAN DECISION REQUIRED", () => {
  const dir = mk();
  try {
    roadmap(dir, row({ status: "designing" }));
    const out = run(dir).stdout;
    assert.match(out, /PROMOTE/);
    assert.match(out, /HUMAN DECISION REQUIRED/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("full lane with no design link -> PROMOTE, HUMAN DECISION REQUIRED", () => {
  const dir = mk();
  try {
    roadmap(dir, row({ status: "planned", lane: "full" }));
    const out = run(dir).stdout;
    assert.match(out, /PROMOTE/);
    assert.match(out, /HUMAN DECISION REQUIRED/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("designed, no plan -> PLAN, SAFE TO ADVANCE", () => {
  const dir = mk();
  try {
    write(dir, "docs/designs/my-feature.md", "# design");
    roadmap(dir, row({ status: "designed", design: "docs/designs/my-feature.md" }));
    const out = run(dir).stdout;
    assert.match(out, /PLAN/);
    assert.match(out, /SAFE TO ADVANCE/);
    assert.match(out, /Transition:/);
    assert.match(out, /status: planned/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("planned with design and plan -> BUILD, SAFE TO ADVANCE", () => {
  const dir = mk();
  try {
    write(dir, "docs/designs/my-feature.md", "# design");
    write(dir, "docs/plans/my-feature-plan.md", "# plan\n## Phase 1 — encoder\n");
    roadmap(dir, row({ status: "planned", lane: "full", design: "docs/designs/my-feature.md", plan: "docs/plans/my-feature-plan.md" }));
    const out = run(dir).stdout;
    assert.match(out, /BUILD/);
    assert.match(out, /SAFE TO ADVANCE/);
    assert.match(out, /Transition:.*in_progress/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("in_progress + building -> BUILD, SAFE TO ADVANCE", () => {
  const dir = mk();
  try {
    write(dir, "docs/plans/my-feature-plan.md", "# plan");
    roadmap(dir, row({ status: "in_progress", active_phase: "1", phase_state: "building", plan: "docs/plans/my-feature-plan.md" }));
    const out = run(dir).stdout;
    assert.match(out, /BUILD/);
    assert.match(out, /SAFE TO ADVANCE/);
    assert.match(out, /Transition:.*in_review/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("in_progress + in_review -> REVIEW, SAFE TO ADVANCE", () => {
  const dir = mk();
  try {
    write(dir, "docs/plans/my-feature-plan.md", "# plan");
    roadmap(dir, row({ status: "in_progress", active_phase: "1", phase_state: "in_review", plan: "docs/plans/my-feature-plan.md" }));
    const out = run(dir).stdout;
    assert.match(out, /REVIEW/);
    assert.match(out, /SAFE TO ADVANCE/);
    assert.match(out, /Transition:.*ready_to_commit/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("in_progress + review_failed -> BUILD, REVIEW FAILED", () => {
  const dir = mk();
  try {
    write(dir, "docs/plans/my-feature-plan.md", "# plan");
    roadmap(dir, row({ status: "in_progress", active_phase: "1", phase_state: "review_failed", plan: "docs/plans/my-feature-plan.md" }));
    const out = run(dir).stdout;
    assert.match(out, /BUILD/);
    assert.match(out, /REVIEW FAILED/);
    assert.match(out, /Transition:.*in_review/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("in_progress + ready_to_commit -> WAIT, COMMIT REQUIRED", () => {
  const dir = mk();
  try {
    write(dir, "docs/plans/my-feature-plan.md", "# plan");
    roadmap(dir, row({ status: "in_progress", active_phase: "1", phase_state: "ready_to_commit", plan: "docs/plans/my-feature-plan.md" }));
    const out = run(dir).stdout;
    assert.match(out, /WAIT FOR COMMIT|COMMIT/);
    assert.match(out, /COMMIT REQUIRED/);
    assert.match(out, /Transition:.*none/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("in_progress + committed, more phases -> ADVANCE, bump active_phase", () => {
  const dir = mk();
  try {
    write(dir, "docs/plans/my-feature-plan.md", "# plan\n## Phase 1 — first\n## Phase 2 — second\n");
    roadmap(dir, row({ status: "in_progress", active_phase: "1", phase_state: "committed", plan: "docs/plans/my-feature-plan.md" }));
    const out = run(dir).stdout;
    assert.match(out, /ADVANCE/);
    assert.match(out, /SAFE TO ADVANCE/);
    assert.match(out, /Transition:.*active_phase: 2/);
    assert.match(out, /Transition:.*phase_state: building/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("in_progress + committed, last phase -> ADVANCE, status done", () => {
  const dir = mk();
  try {
    write(dir, "docs/plans/my-feature-plan.md", "# plan\n## Phase 1 — only\n");
    roadmap(dir, row({ status: "in_progress", active_phase: "1", phase_state: "committed", plan: "docs/plans/my-feature-plan.md" }));
    const out = run(dir).stdout;
    assert.match(out, /ADVANCE/);
    assert.match(out, /Transition:.*status: done/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("in_progress + committed, plan unresolvable -> ADVANCE, cannot count phases", () => {
  const dir = mk();
  try {
    roadmap(dir, row({ status: "in_progress", active_phase: "1", phase_state: "committed", plan: "docs/plans/nonexistent.md" }));
    const out = run(dir).stdout;
    assert.match(out, /ADVANCE/);
    assert.match(out, /cannot count phases|unresolvable/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("blocked -> UNBLOCK, BLOCKED gate", () => {
  const dir = mk();
  try {
    roadmap(dir, row({ status: "blocked", blocked_by: "waiting on dep" }));
    const out = run(dir).stdout;
    assert.match(out, /UNBLOCK/);
    assert.match(out, /BLOCKED/);
    assert.match(out, /waiting on dep/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("done -> NOTHING, suggest shipped, SAFE TO ADVANCE", () => {
  const dir = mk();
  try {
    roadmap(dir, row({ status: "done" }));
    const out = run(dir, ["--id", "my-feature"]).stdout;
    assert.match(out, /NOTHING/);
    assert.match(out, /SAFE TO ADVANCE/);
    assert.match(out, /shipped/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- Conflict detection ---

test("conflict: ready_to_commit but tree is clean -> HUMAN DECISION REQUIRED", () => {
  const dir = mk();
  try {
    write(dir, "docs/plans/my-feature-plan.md", "# plan");
    roadmap(dir, row({ status: "in_progress", active_phase: "1", phase_state: "ready_to_commit", plan: "docs/plans/my-feature-plan.md" }));
    // Commit everything so the tree is clean when advance.js runs
    const git = (args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    git(["init", "-q"]);
    git(["config", "user.email", "test@test.com"]);
    git(["config", "user.name", "Test"]);
    git(["add", "-A"]);
    git(["-c", "commit.gpgsign=false", "commit", "-qm", "init"]);
    const out = run(dir).stdout;
    assert.match(out, /HUMAN DECISION REQUIRED/);
    assert.match(out, /ready_to_commit.*clean|clean.*ready_to_commit/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("conflict: design link missing on disk -> HUMAN DECISION REQUIRED", () => {
  const dir = mk();
  try {
    roadmap(dir, row({ status: "designed", design: "docs/designs/missing.md" }));
    const out = run(dir).stdout;
    assert.match(out, /HUMAN DECISION REQUIRED/);
    assert.match(out, /missing\.md.*missing|missing.*missing\.md/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("conflict: plan link missing on disk -> HUMAN DECISION REQUIRED", () => {
  const dir = mk();
  try {
    write(dir, "docs/designs/my-feature.md", "# design");
    roadmap(dir, row({ status: "planned", lane: "full", design: "docs/designs/my-feature.md", plan: "docs/plans/missing.md" }));
    const out = run(dir).stdout;
    assert.match(out, /HUMAN DECISION REQUIRED/);
    assert.match(out, /missing\.md.*missing|missing.*missing\.md/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("no conflicts on a clean planned row with existing files", () => {
  const dir = mk();
  try {
    write(dir, "docs/designs/my-feature.md", "# design");
    write(dir, "docs/plans/my-feature-plan.md", "# plan\n## Phase 1 — work\n");
    roadmap(dir, row({ status: "planned", lane: "full", design: "docs/designs/my-feature.md", plan: "docs/plans/my-feature-plan.md" }));
    const out = run(dir).stdout;
    assert.doesNotMatch(out, /Conflicts:/);
    assert.doesNotMatch(out, /HUMAN DECISION REQUIRED/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- Degradation ---

test("no ROADMAP.md -> exits 0 with fallback message", () => {
  const dir = mk();
  try {
    const r = run(dir);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /No ROADMAP\.md/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("schema-less roadmap -> exits 0 with fallback message", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", "## Now\n- Feature A\n- Feature B\n");
    const r = run(dir);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /no schema rows|falls back to prose/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- setFields ---

test("setFields: updates existing field in place", () => {
  const text = [
    "## Now",
    "- [ ] Thing  <!-- id: thing -->",
    "  - status: planned",
    "  - active_phase: 0",
  ].join("\n");
  const result = setFields(text, "thing", { status: "in_progress", active_phase: "1" });
  assert.ok(result !== null);
  assert.match(result, /- status: in_progress/);
  assert.match(result, /- active_phase: 1/);
  assert.doesNotMatch(result, /- status: planned/);
});

test("setFields: appends missing key after last existing field bullet", () => {
  const text = [
    "## Now",
    "- [ ] Thing  <!-- id: thing -->",
    "  - status: planned",
  ].join("\n");
  const result = setFields(text, "thing", { phase_state: "building" });
  assert.ok(result !== null);
  assert.match(result, /- phase_state: building/);
  assert.match(result, /- status: planned/);
});

test("setFields: preserves CRLF line endings byte-for-byte outside changed lines", () => {
  const text = "## Now\r\n- [ ] Thing  <!-- id: thing -->\r\n  - status: planned\r\n  - active_phase: 0\r\n";
  const result = setFields(text, "thing", { status: "in_progress" });
  assert.ok(result !== null);
  assert.ok(result.includes("\r\n"), "should preserve CRLF");
  assert.match(result, /- status: in_progress/);
  // unchanged line preserved byte-for-byte
  assert.ok(result.includes("  - active_phase: 0\r\n"), "unchanged line should be byte-for-byte identical");
});

test("setFields: returns null when id not found", () => {
  const text = "## Now\n- [ ] Thing  <!-- id: thing -->\n  - status: planned\n";
  const result = setFields(text, "nonexistent", { status: "done" });
  assert.strictEqual(result, null);
});

test("setFields: null value written as em dash", () => {
  const text = "## Now\n- [ ] Thing  <!-- id: thing -->\n  - status: planned\n  - phase_state: building\n";
  const result = setFields(text, "thing", { phase_state: null });
  assert.ok(result !== null);
  assert.match(result, /- phase_state: —/);
});

test("setFields: preserves unrelated rows and prose untouched", () => {
  const text = [
    "## Now",
    "- [ ] Thing  <!-- id: thing -->",
    "  - status: planned",
    "- [ ] Other  <!-- id: other -->",
    "  - status: idea",
    "",
    "Some prose.",
  ].join("\n");
  const result = setFields(text, "thing", { status: "in_progress" });
  assert.ok(result !== null);
  assert.match(result, /- \[ \] Other.*id: other/s);
  assert.match(result, /- status: idea/);
  assert.match(result, /Some prose\./);
});

// --- --apply writes the transition to ROADMAP.md ---

test("--apply writes prescribed transition to ROADMAP.md", () => {
  const dir = mk();
  try {
    write(dir, "docs/designs/my-feature.md", "# design");
    write(dir, "docs/plans/my-feature-plan.md", "# plan\n## Phase 1 — work\n## Phase 2 — more\n");
    write(dir, "docs/ROADMAP.md", row({ status: "planned", lane: "full", design: "docs/designs/my-feature.md", plan: "docs/plans/my-feature-plan.md" }));
    const r = run(dir, ["--apply", "--id", "my-feature"]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Applied:/);
    const updated = fs.readFileSync(path.join(dir, "docs/ROADMAP.md"), "utf8");
    assert.match(updated, /- status: in_progress/);
    assert.match(updated, /- active_phase: 1/);
    assert.match(updated, /- phase_state: building/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("--apply --set overrides the prescribed transition", () => {
  const dir = mk();
  try {
    write(dir, "docs/plans/my-feature-plan.md", "# plan");
    write(dir, "docs/ROADMAP.md", row({ status: "in_progress", active_phase: "1", phase_state: "in_review", plan: "docs/plans/my-feature-plan.md" }));
    const r = run(dir, ["--apply", "--id", "my-feature", "--set", "phase_state=review_failed"]);
    assert.equal(r.status, 0, r.stderr);
    const updated = fs.readFileSync(path.join(dir, "docs/ROADMAP.md"), "utf8");
    assert.match(updated, /- phase_state: review_failed/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
