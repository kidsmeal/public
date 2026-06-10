"use strict";
/*
 * Tests for /compass:status (status.js). Exercises artifact detection and
 * roadmap state signals against temp-dir fixtures. git checks degrade to
 * no-ops when no repo is present; these cover the fs-only core.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const STATUS = path.join(__dirname, "..", "plugins", "compass", "scripts", "status.js");

function mk() { return fs.mkdtempSync(path.join(os.tmpdir(), "compass-status-")); }
function write(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function run(dir) {
  return spawnSync(process.execPath, [STATUS], {
    encoding: "utf8",
    env: { ...process.env, COMPASS_PROJECT_DIR: dir, CLAUDE_PROJECT_DIR: dir },
  });
}

test("shows [missing] for artifacts that do not exist", () => {
  const dir = mk();
  try {
    const out = run(dir).stdout;
    assert.match(out, /\[missing\] roadmap/);
    assert.match(out, /\[missing\] map index/);
    assert.match(out, /\[missing\] NOW\.md cursor/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("shows [ok] for each artifact that exists", () => {
  const dir = mk();
  try {
    write(dir, "NOW.md", "# NOW\n");
    write(dir, "docs/ROADMAP.md", "## Now\n- [ ] thing\n  - status: idea\n");
    write(dir, "docs/INDEX.md", "# Index\n");
    const out = run(dir).stdout;
    assert.match(out, /\[ok\] NOW\.md cursor/);
    assert.match(out, /\[ok\] roadmap/);
    assert.match(out, /\[ok\] map index/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("roadmap section shows the active feature when one is in_progress", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", [
      "## Now",
      "- [ ] My feature  <!-- id: my-feature -->",
      "  - status: in_progress",
      "  - active_phase: 2",
      "  - phase_state: in_review",
      "  - design: docs/designs/my-feature.md",
      "  - plan: docs/plans/my-feature-plan.md",
    ].join("\n"));
    const out = run(dir).stdout;
    assert.match(out, /active:[\s\S]*my-feature/);
    assert.match(out, /in_progress/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("roadmap section falls back gracefully when no features are active", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", "## Now\n- [ ] nothing queued\n  - status: idea\n");
    const out = run(dir).stdout;
    assert.match(out, /Roadmap \(the hub\)/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
