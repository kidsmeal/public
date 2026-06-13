"use strict";
/*
 * Tests for the edit-time drift hook (plugins/cartographer/hooks/cited-file-note.js).
 * End-to-end: spawn the script with a PostToolUse payload on stdin, assert on
 * stdout + exit code. Each test uses a fresh random session id so the dedupe
 * sentinels can't leak between tests or runs.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HOOK = path.join(__dirname, "..", "plugins", "cartographer", "hooks", "cited-file-note.js");
const { normalize } = require(HOOK);

function mk() { return fs.mkdtempSync(path.join(os.tmpdir(), "cartographer-hook-")); }
function w(dir, rel, c) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, c);
}
function runHook(root, payload) {
  return execFileSync(process.execPath, [HOOK], {
    encoding: "utf8",
    input: JSON.stringify(payload),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, CARTOGRAPHER_PROJECT_DIR: "" },
  });
}
function payloadFor(root, rel, session) {
  return {
    session_id: session,
    tool_name: "Edit",
    tool_input: { file_path: path.join(root, rel) },
    cwd: root,
  };
}
function sid() { return "test-" + crypto.randomUUID(); }

test("editing a cited file emits a one-line note naming the citing doc", () => {
  const dir = mk();
  try {
    w(dir, "src/auth/login.ts", "x");
    w(dir, "docs/INDEX.md", "# Index\nAuth lives in `src/auth/login.ts`.\n");
    const out = runHook(dir, payloadFor(dir, "src/auth/login.ts", sid()));
    const parsed = JSON.parse(out);
    const note = parsed.hookSpecificOutput.additionalContext;
    assert.equal(parsed.hookSpecificOutput.hookEventName, "PostToolUse");
    assert.match(note, /docs\/INDEX\.md cites src\/auth\/login\.ts/);
    assert.match(note, /moved or renamed/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("editing an uncited file stays silent", () => {
  const dir = mk();
  try {
    w(dir, "src/other.ts", "x");
    w(dir, "docs/INDEX.md", "# Index\nAuth lives in `src/auth/login.ts`.\n");
    assert.equal(runHook(dir, payloadFor(dir, "src/other.ts", sid())), "");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a second edit to the same file in the same session stays silent", () => {
  const dir = mk();
  try {
    w(dir, "src/app.js", "x");
    w(dir, "docs/INDEX.md", "# Index\nApp lives in `src/app.js`.\n");
    const session = sid();
    assert.notEqual(runHook(dir, payloadFor(dir, "src/app.js", session)), "", "first edit should note");
    assert.equal(runHook(dir, payloadFor(dir, "src/app.js", session)), "", "second edit should be silent");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a different session notes the same file again", () => {
  const dir = mk();
  try {
    w(dir, "src/app.js", "x");
    w(dir, "docs/INDEX.md", "# Index\nApp lives in `src/app.js`.\n");
    assert.notEqual(runHook(dir, payloadFor(dir, "src/app.js", sid())), "");
    assert.notEqual(runHook(dir, payloadFor(dir, "src/app.js", sid())), "");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("no standing docs -> silence", () => {
  const dir = mk();
  try {
    w(dir, "src/app.js", "x");
    assert.equal(runHook(dir, payloadFor(dir, "src/app.js", sid())), "");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("multiple citing docs are all named in one line", () => {
  const dir = mk();
  try {
    w(dir, "src/app.js", "x");
    w(dir, "docs/INDEX.md", "# Index\nApp lives in `src/app.js`.\n");
    w(dir, "CLAUDE.md", "See `src/app.js`.\n");
    const out = runHook(dir, payloadFor(dir, "src/app.js", sid()));
    const note = JSON.parse(out).hookSpecificOutput.additionalContext;
    assert.match(note, /docs\/INDEX\.md and CLAUDE\.md cite src\/app\.js/);
    assert.equal(out.trim().split("\n").length, 1, "note should be a single line");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("malformed stdin and missing fields fail silent with exit 0", () => {
  const dir = mk();
  try {
    for (const input of ["not json", "{}", JSON.stringify({ tool_input: {} })]) {
      const out = execFileSync(process.execPath, [HOOK], {
        encoding: "utf8", input, env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
      });
      assert.equal(out, "");
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("normalize handles Windows-style paths identically on any host", () => {
  assert.equal(normalize("C:\\repo\\src\\app.js", "c:\\repo"), "src/app.js");
  assert.equal(normalize("c:/repo/src/app.js", "C:/repo"), "src/app.js");
  assert.equal(normalize("/repo/src/app.js", "/repo"), "src/app.js");
  assert.equal(normalize("/elsewhere/app.js", "/repo"), null, "outside the root -> null");
  assert.equal(normalize("", "/repo"), null);
});
