"use strict";
/*
 * Tests for sessionbrief.js (the SessionStart hook).
 * Verifies silent behavior in non-compass projects, line-1 format for live rows,
 * and line-2 signals.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BRIEF = path.join(__dirname, "..", "plugins", "compass", "scripts", "sessionbrief.js");

function mk() { return fs.mkdtempSync(path.join(os.tmpdir(), "compass-brief-")); }
function write(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function run(dir) {
  return spawnSync(process.execPath, [BRIEF], {
    encoding: "utf8",
    env: { ...process.env, COMPASS_PROJECT_DIR: dir, CLAUDE_PROJECT_DIR: dir },
  });
}

test("silent when no ROADMAP.md", () => {
  const dir = mk();
  try {
    const r = run(dir);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), "");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("silent when roadmap has no schema rows", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", "## Now\n- Feature A\n- Feature B\n");
    const r = run(dir);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), "");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("silent when all schema rows are done", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", [
      "## Now",
      "- [x] Thing  <!-- id: thing -->",
      "  - status: done",
    ].join("\n"));
    const r = run(dir);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), "");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("line 1 shows title, id, and status/phase/phase_state for active row", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", [
      "## Now",
      "- [ ] CSV Export  <!-- id: csv-export -->",
      "  - status: in_progress",
      "  - active_phase: 2",
      "  - phase_state: building",
    ].join("\n"));
    const r = run(dir);
    assert.equal(r.status, 0);
    const lines = r.stdout.trim().split(/\r?\n/);
    assert.match(lines[0], /compass:.*CSV Export.*\[csv-export\]/);
    assert.match(lines[0], /in_progress/);
    assert.match(lines[0], /2/);
    assert.match(lines[0], /building/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("line 2 appears for a blocked row", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", [
      "## Now",
      "- [ ] Active  <!-- id: active -->",
      "  - status: in_progress",
      "  - active_phase: 1",
      "  - phase_state: building",
      "- [ ] Blocked  <!-- id: blocked-thing -->",
      "  - status: blocked",
      "  - blocked_by: waiting on dep",
    ].join("\n"));
    const r = run(dir);
    const lines = r.stdout.trim().split(/\r?\n/);
    assert.equal(lines.length, 2, "should print exactly two lines");
    assert.match(lines[1], /blocked/i);
    assert.match(lines[1], /1 row/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("line 2 absent when no blocked rows and no lint warnings", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", [
      "## Now",
      "- [ ] Active  <!-- id: active -->",
      "  - status: in_progress",
      "  - active_phase: 1",
      "  - phase_state: building",
      "  - lane: small",
      "  - plan: docs/plans/active-plan.md",
    ].join("\n"));
    const r = run(dir);
    const lines = r.stdout.trim().split(/\r?\n/);
    assert.equal(lines.length, 1, "should print only one line");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
