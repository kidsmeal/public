"use strict";
/*
 * Tests for /compass:doctor (doctor.js). The git-based checks no-op without a
 * git repo, so these exercise the fs-based core: broken links, orphan docs, lint
 * passthrough, and a clean project. doctor.js is read-only, so the tests just
 * assert on its report.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DOCTOR = path.join(__dirname, "..", "plugins", "compass", "scripts", "doctor.js");

function mk() { return fs.mkdtempSync(path.join(os.tmpdir(), "compass-doctor-")); }
function write(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function runDoctor(dir) {
  const r = spawnSync(process.execPath, [DOCTOR], {
    encoding: "utf8",
    env: { ...process.env, COMPASS_PROJECT_DIR: dir, CLAUDE_PROJECT_DIR: dir },
  });
  return r.stdout || "";
}

test("flags a roadmap row that links a missing design/plan file as an error", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", [
      "## Now",
      "- [ ] Thing  <!-- id: thing -->",
      "  - status: planned",
      "  - design: docs/designs/thing.md",
      "  - plan: docs/plans/thing-plan.md",
    ].join("\n"));
    const out = runDoctor(dir);
    assert.match(out, /\[ERROR\][\s\S]*thing[\s\S]*missing file/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("flags an orphan plan and stops flagging links once the files exist", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", [
      "## Now",
      "- [ ] Thing  <!-- id: thing -->",
      "  - status: planned",
      "  - design: docs/designs/thing.md",
      "  - plan: docs/plans/thing-plan.md",
    ].join("\n"));
    write(dir, "docs/designs/thing.md", "# design");
    write(dir, "docs/plans/thing-plan.md", "# plan");
    write(dir, "docs/plans/orphan-plan.md", "# orphan");
    const out = runDoctor(dir);
    assert.match(out, /orphan doc not linked[\s\S]*orphan-plan\.md/);
    assert.doesNotMatch(out, /missing file/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("flags a row that appears in SHIPPED.md but is not done", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", [
      "## Now",
      "- [ ] My feature  <!-- id: my-feature -->",
      "  - status: in_progress",
      "  - design: docs/designs/my-feature.md",
      "  - plan: docs/plans/my-feature-plan.md",
      "  - phase_state: building",
    ].join("\n"));
    write(dir, "docs/designs/my-feature.md", "# design");
    write(dir, "docs/plans/my-feature-plan.md", "# plan");
    write(dir, "SHIPPED.md", "### 2026-06-01\n- my-feature shipped\n");
    const out = runDoctor(dir);
    assert.match(out, /\[WARN\][\s\S]*my-feature[\s\S]*SHIPPED\.md[\s\S]*not done/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("flags a done row under Now as an archival note", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", [
      "## Now",
      "- [x] Old thing  <!-- id: old-thing -->",
      "  - status: done",
      "  - design: docs/designs/old-thing.md",
      "  - plan: docs/plans/old-thing-plan.md",
    ].join("\n"));
    write(dir, "docs/designs/old-thing.md", "# design");
    write(dir, "docs/plans/old-thing-plan.md", "# plan");
    const out = runDoctor(dir);
    assert.match(out, /\[INFO\][\s\S]*old-thing[\s\S]*Shipped/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("does not flag a done row already under Shipped", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", [
      "## Now",
      "- [ ] Active thing  <!-- id: active -->",
      "  - status: idea",
      "## Shipped",
      "- [x] Old thing  <!-- id: old-thing -->",
      "  - status: done",
    ].join("\n"));
    const out = runDoctor(dir);
    assert.doesNotMatch(out, /old-thing[\s\S]*archive/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("warns when CURRENTNESS_AUDIT.md has unchecked Open doc flags entries", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", "## Now\n- [ ] Thing  <!-- id: thing -->\n  - status: idea\n");
    write(dir, "CURRENTNESS_AUDIT.md", [
      "# Currentness Audit",
      "",
      "## Open doc flags",
      "",
      "- [ ] docs/INDEX.md: auth section outdated by login refactor (phase 2, my-feature)",
      "- [x] docs/GLOSSARY.md: term added (phase 1, setup)",
      "",
      "## Rule of thumb",
    ].join("\n"));
    const out = runDoctor(dir);
    assert.match(out, /\[WARN\][\s\S]*1 unchecked.*Open doc flags/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a clean idea-stage project reports no errors", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", [
      "## Now",
      "- [ ] Thing  <!-- id: thing -->",
      "  - status: idea",
    ].join("\n"));
    const out = runDoctor(dir);
    assert.doesNotMatch(out, /\[ERROR\]/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
