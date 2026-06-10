"use strict";
/*
 * Tests for /compass:init (init.js). Checks artifact detection and seam-file
 * reporting. Read-only; creates no files.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const INIT = path.join(__dirname, "..", "plugins", "compass", "scripts", "init.js");

function mk() { return fs.mkdtempSync(path.join(os.tmpdir(), "compass-init-")); }
function write(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function run(dir) {
  return spawnSync(process.execPath, [INIT], {
    encoding: "utf8",
    env: { ...process.env, COMPASS_PROJECT_DIR: dir, CLAUDE_PROJECT_DIR: dir },
  });
}

test("shows all three instruments as [missing] in an empty project", () => {
  const dir = mk();
  try {
    const out = run(dir).stdout;
    assert.match(out, /\[missing\].*Cartographer/);
    assert.match(out, /\[missing\].*ClauDHD/);
    assert.match(out, /\[missing\].*Gantry/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("shows Cartographer as [ready] when a map index exists", () => {
  const dir = mk();
  try {
    write(dir, "docs/INDEX.md", "# Index\n");
    const out = run(dir).stdout;
    assert.match(out, /\[ready\].*Cartographer/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("shows ClauDHD as [ready] when NOW.md exists", () => {
  const dir = mk();
  try {
    write(dir, "NOW.md", "# NOW\n");
    const out = run(dir).stdout;
    assert.match(out, /\[ready\].*ClauDHD/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("reports the roadmap seam file when ROADMAP.md is present", () => {
  const dir = mk();
  try {
    write(dir, "docs/ROADMAP.md", "## Now\n- [ ] thing\n");
    const out = run(dir).stdout;
    assert.match(out, /roadmap\s*:[\s\S]*ROADMAP\.md/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("conventions seam does not show AGENTS.md or CLAUDE.md", () => {
  const dir = mk();
  try {
    write(dir, "AGENTS.md", "# agents\n");
    write(dir, "CLAUDE.md", "# claude\n");
    const out = run(dir).stdout;
    // With AGENTS.md and CLAUDE.md present but no CONVENTIONS.md, conventions should be (none...)
    assert.match(out, /conventions\s*:.*\(none/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("conventions seam shows CONVENTIONS.md when present", () => {
  const dir = mk();
  try {
    write(dir, "CONVENTIONS.md", "# conventions\n");
    const out = run(dir).stdout;
    assert.match(out, /conventions\s*:[\s\S]*CONVENTIONS\.md/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
