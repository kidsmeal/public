"use strict";
/* Tests for gantry init script. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const INIT_SCRIPT = path.join(__dirname, "..", "plugins", "gantry", "scripts", "init.js");

function mk() { return fs.mkdtempSync(path.join(os.tmpdir(), "gantry-init-")); }
function write(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function run(dir) {
  return spawnSync(process.execPath, [INIT_SCRIPT], {
    encoding: "utf8",
    env: { ...process.env, GANTRY_PROJECT_DIR: dir },
  });
}

test("scaffolds CURRENTNESS_AUDIT.md and RUNTIME_VERIFICATION_QUEUE.md into docs/ when docs/ exists", () => {
  const dir = mk();
  try {
    fs.mkdirSync(path.join(dir, "docs"));
    const r = run(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(fs.existsSync(path.join(dir, "docs", "CURRENTNESS_AUDIT.md")), "docs/CURRENTNESS_AUDIT.md should be created");
    assert.ok(fs.existsSync(path.join(dir, "docs", "RUNTIME_VERIFICATION_QUEUE.md")), "docs/RUNTIME_VERIFICATION_QUEUE.md should be created");
    assert.match(r.stdout, /Gantry init complete/);
    assert.match(r.stdout, /CURRENTNESS_AUDIT\.md/);
    assert.match(r.stdout, /RUNTIME_VERIFICATION_QUEUE\.md/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("scaffolds files to project root when docs/ is absent", () => {
  const dir = mk();
  try {
    const r = run(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(fs.existsSync(path.join(dir, "CURRENTNESS_AUDIT.md")), "CURRENTNESS_AUDIT.md should be created at root");
    assert.ok(fs.existsSync(path.join(dir, "RUNTIME_VERIFICATION_QUEUE.md")), "RUNTIME_VERIFICATION_QUEUE.md should be created at root");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("does not overwrite existing audit docs", () => {
  const dir = mk();
  try {
    write(dir, "CURRENTNESS_AUDIT.md", "# My existing audit\n");
    const r = run(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(fs.readFileSync(path.join(dir, "CURRENTNESS_AUDIT.md"), "utf8"), "# My existing audit\n", "existing file should not be overwritten");
    assert.match(r.stdout, /Kept existing/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("detects Node/JS stack when package.json is present", () => {
  const dir = mk();
  try {
    write(dir, "package.json", JSON.stringify({ scripts: { test: "node --test", build: "tsc" } }));
    const r = run(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Node\/JS/);
    assert.match(r.stdout, /npm test/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("uses pnpm for the commands when pnpm-lock.yaml is present", () => {
  const dir = mk();
  try {
    write(dir, "package.json", JSON.stringify({ scripts: { test: "node --test" } }));
    write(dir, "pnpm-lock.yaml", "");
    const r = run(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /pnpm test/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("detects Gradle and Ruby stacks independently of other manifests", () => {
  const dir = mk();
  try {
    write(dir, "build.gradle", "");
    write(dir, "Gemfile", "");
    write(dir, "go.mod", "module x\n"); // must not mask Ruby detection
    const r = run(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Gradle/);
    assert.match(r.stdout, /Ruby/);
    assert.match(r.stdout, /\bGo\b/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
