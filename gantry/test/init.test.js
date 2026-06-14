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
// runEnv: like run() but applies explicit overrides on top of process.env.
// Pass a key with value undefined to delete it from the child env (prevents
// host-environment leakage of CLAUDE_PLUGIN_ROOT into "unset" test cases).
function runEnv(dir, overrides) {
  const env = Object.assign({}, process.env, { GANTRY_PROJECT_DIR: dir });
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete env[k];
    } else {
      env[k] = v;
    }
  }
  return spawnSync(process.execPath, [INIT_SCRIPT], { encoding: "utf8", env });
}
// runEnvArgs: like runEnv() but passes extra argv to the script.
function runEnvArgs(dir, overrides, args) {
  const env = Object.assign({}, process.env, { GANTRY_PROJECT_DIR: dir });
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete env[k];
    } else {
      env[k] = v;
    }
  }
  return spawnSync(process.execPath, [INIT_SCRIPT, ...args], { encoding: "utf8", env });
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

// ---------------------------------------------------------------------------
// Plugin-native hook opt-in (CLAUDE_PLUGIN_ROOT gated)
// ---------------------------------------------------------------------------

// Default run (no --enable-hooks flag): the opt-in MARKER must NOT be written
// (enforcement stays inert). The .gitignore IS written though, because
// models.json (per-machine config) is scaffolded every run and must be ignored.
test("with CLAUDE_PLUGIN_ROOT set (default run): does NOT write .gantry/enabled, but gitignores models.json", () => {
  const dir = mk();
  try {
    const r = runEnv(dir, { CLAUDE_PLUGIN_ROOT: "/fake/plugin/root" });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!fs.existsSync(path.join(dir, ".gantry", "enabled")), ".gantry/enabled must NOT be created on default run");
    const gi = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
    assert.ok(gi.includes(".gantry/models.json"), "per-machine models.json must be gitignored even on default run");
    assert.match(r.stdout, /enforcement is available but NOT enabled/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Opt-in path (--enable-hooks flag): marker and .gitignore are written.
test("with CLAUDE_PLUGIN_ROOT set and --enable-hooks: writes .gantry/enabled and creates .gitignore", () => {
  const dir = mk();
  try {
    const r = runEnvArgs(dir, { CLAUDE_PLUGIN_ROOT: "/fake/plugin/root" }, ["--enable-hooks"]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(fs.existsSync(path.join(dir, ".gantry", "enabled")), ".gantry/enabled should be created");
    assert.ok(fs.existsSync(path.join(dir, ".gitignore")), ".gitignore should be created");
    const gi = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
    assert.ok(gi.includes(".gantry/active-phase.json"), ".gitignore should contain .gantry/active-phase.json");
    assert.match(r.stdout, /Created .gantry\/enabled/);
    assert.match(r.stdout, /Created .gitignore/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("with CLAUDE_PLUGIN_ROOT set and --enable-hooks: does not duplicate .gitignore entry when already present", () => {
  const dir = mk();
  try {
    write(dir, ".gitignore", ".gantry/active-phase.json\n");
    const r = runEnvArgs(dir, { CLAUDE_PLUGIN_ROOT: "/fake/plugin/root" }, ["--enable-hooks"]);
    assert.equal(r.status, 0, r.stderr);
    const gi = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
    const count = gi.split(".gantry/active-phase.json").length - 1;
    assert.equal(count, 1, ".gantry/active-phase.json must appear exactly once");
    assert.match(r.stdout, /already contains/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("with CLAUDE_PLUGIN_ROOT set and --enable-hooks: appends entry once to existing .gitignore that lacks it", () => {
  const dir = mk();
  try {
    write(dir, ".gitignore", "node_modules/\n*.log\n");
    const r = runEnvArgs(dir, { CLAUDE_PLUGIN_ROOT: "/fake/plugin/root" }, ["--enable-hooks"]);
    assert.equal(r.status, 0, r.stderr);
    const gi = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
    assert.ok(gi.includes(".gantry/active-phase.json"), "entry should be appended");
    assert.ok(gi.includes("node_modules/"), "existing content must be preserved");
    const count = gi.split(".gantry/active-phase.json").length - 1;
    assert.equal(count, 1, "entry must appear exactly once");
    assert.match(r.stdout, /Appended .gantry\/active-phase\.json/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("with CLAUDE_PLUGIN_ROOT set and --enable-hooks: gitignores models.json and the headless settings too", () => {
  const dir = mk();
  try {
    const r = runEnvArgs(dir, { CLAUDE_PLUGIN_ROOT: "/fake/plugin/root" }, ["--enable-hooks"]);
    assert.equal(r.status, 0, r.stderr);
    const gi = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
    assert.ok(gi.includes(".gantry/models.json"), ".gitignore should ignore the per-machine models.json");
    assert.ok(gi.includes(".gantry/headless-implementer-settings.json"), ".gitignore should ignore the transient headless settings");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("with CLAUDE_PLUGIN_ROOT unset: writes no .gantry/enabled, but still gitignores models.json", () => {
  const dir = mk();
  try {
    const r = runEnv(dir, { CLAUDE_PLUGIN_ROOT: undefined });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!fs.existsSync(path.join(dir, ".gantry", "enabled")), ".gantry/enabled must NOT be created when CLAUDE_PLUGIN_ROOT is unset");
    // A manual (non-plugin) copy still scaffolds models.json, so it must still
    // be gitignored - leaving per-machine config un-ignored is the bug.
    const gi = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
    assert.ok(gi.includes(".gantry/models.json"), "models.json must be gitignored even for a manual copy");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
