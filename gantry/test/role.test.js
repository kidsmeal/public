"use strict";
/* CLI-level tests for role.js resolve: the fail-safe-to-native behavior for
 * ordinary config errors, and the one hard stop (off-harness implementer). */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROLE = path.join(__dirname, "..", "plugins", "gantry", "scripts", "role.js");

function mk() { return fs.mkdtempSync(path.join(os.tmpdir(), "gantry-role-")); }
function writeConfig(dir, config) {
  fs.mkdirSync(path.join(dir, ".gantry"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".gantry", "models.json"), JSON.stringify(config));
}
function resolve(dir, role) {
  return spawnSync(process.execPath, [ROLE, "resolve", role], {
    encoding: "utf8",
    env: { ...process.env, GANTRY_PROJECT_DIR: dir },
  });
}

const CODEX = {
  type: "cli",
  cmd: "codex exec --model {model} --sandbox {sandbox} --skip-git-repo-check",
  promptVia: "stdin",
  sandbox: "workspace-write",
};

test("resolve: no models.json -> native, exit 0", () => {
  const dir = mk();
  try {
    const r = resolve(dir, "phase-reviewer");
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /DISPATCH: native/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("resolve: valid external backend -> external, exit 0", () => {
  const dir = mk();
  try {
    writeConfig(dir, {
      roles: { "phase-reviewer": { backend: "codex", model: "gpt-5.5" } },
      backends: { native: { type: "native" }, codex: CODEX },
    });
    const r = resolve(dir, "phase-reviewer");
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /DISPATCH: external/);
    assert.match(r.stdout, /gpt-5\.5/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("resolve: ordinary config error (unknown backend) FAILS SAFE to native, exit 0 with a warning", () => {
  const dir = mk();
  try {
    writeConfig(dir, {
      roles: { "phase-reviewer": { backend: "ghost", model: "x" } },
      backends: { native: { type: "native" } },
    });
    const r = resolve(dir, "phase-reviewer");
    assert.equal(r.status, 0, "ordinary config errors must not be fatal");
    assert.match(r.stdout, /DISPATCH: native/);
    assert.match(r.stderr, /config issue/i); // warned, not silent
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("resolve: off-harness implementer is the one HARD STOP, exit non-zero", () => {
  const dir = mk();
  try {
    writeConfig(dir, {
      roles: { implementer: { backend: "codex", model: "gpt-5.5" } },
      backends: { native: { type: "native" }, codex: CODEX },
    });
    const r = resolve(dir, "implementer");
    assert.notEqual(r.status, 0, "off-harness implementer must fail, not fall back silently");
    assert.match(r.stderr, /off-harness|harness/i);
    assert.doesNotMatch(r.stdout, /DISPATCH: native/); // must NOT silently downgrade
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("resolve: implementer with an unknown backend (a typo) fails safe to native, exit 0", () => {
  const dir = mk();
  try {
    writeConfig(dir, {
      roles: { implementer: { backend: "typo", model: "x" } },
      backends: { native: { type: "native" } },
    });
    const r = resolve(dir, "implementer");
    assert.equal(r.status, 0, "a typo is an accident, fail-safe to native (native is harness-safe)");
    assert.match(r.stdout, /DISPATCH: native/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
