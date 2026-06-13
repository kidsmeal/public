"use strict";
/* Tests for verify.js (Workstream C3). fs-based; no git needed. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { verifyDocs } = require("../plugins/cartographer/scripts/verify.js");

function mk() { return fs.mkdtempSync(path.join(os.tmpdir(), "cartographer-verify-")); }
function w(dir, rel, c) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, c);
}

test("clean: every cited path and anchor resolves", () => {
  const dir = mk();
  try {
    w(dir, "src/auth/login.ts", "x");                       // root-relative code-path target
    w(dir, "docs/GLOSSARY.md", "## Token\nstuff\n");
    w(dir, "docs/INDEX.md", [
      "# Index",
      "Auth lives in `src/auth/login.ts`.",
      "See [the glossary](GLOSSARY.md#token).",              // doc-relative link + anchor
    ].join("\n"));
    const { findings } = verifyDocs(dir);
    assert.equal(findings.length, 0, JSON.stringify(findings));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("flags a cited path that no longer exists", () => {
  const dir = mk();
  try {
    w(dir, "docs/INDEX.md", "See `src/gone/missing.ts` for X.");
    const { findings } = verifyDocs(dir);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].kind, "missing-path");
    assert.match(findings[0].detail, /missing\.ts/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("flags an anchor that no longer resolves in an existing doc", () => {
  const dir = mk();
  try {
    w(dir, "docs/GLOSSARY.md", "## Token\n");
    w(dir, "docs/INDEX.md", "See [x](GLOSSARY.md#nonexistent).");
    const { findings } = verifyDocs(dir);
    assert.ok(findings.some((f) => f.kind === "missing-anchor" && /nonexistent/.test(f.detail)));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("symbol citation passes while the symbol exists in the target", () => {
  const dir = mk();
  try {
    w(dir, "src/server.js", "function bootServer() {}\nmodule.exports = { bootServer };\n");
    w(dir, "docs/INDEX.md", "Boot: `src/server.js::bootServer`.\n");
    const { findings } = verifyDocs(dir);
    assert.equal(findings.length, 0, JSON.stringify(findings));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("flags missing-symbol when the cited symbol is gone (word-bound, no substring rescue)", () => {
  const dir = mk();
  try {
    w(dir, "src/server.js", "function bootServerQuickly() {}\n");
    w(dir, "docs/INDEX.md", "Boot: `src/server.js::bootServer`.\n");
    const { findings } = verifyDocs(dir);
    assert.equal(findings.length, 1, JSON.stringify(findings));
    assert.equal(findings[0].kind, "missing-symbol");
    assert.equal(findings[0].detail, "::bootServer");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("symbol check is skipped for non-code targets", () => {
  const dir = mk();
  try {
    w(dir, "docs/notes.md", "no such identifier here\n");
    w(dir, "docs/INDEX.md", "See `docs/notes.md::bootServer`.\n");
    const { findings } = verifyDocs(dir);
    assert.equal(findings.length, 0, JSON.stringify(findings));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a symbol citation on a missing file reports missing-path, not missing-symbol", () => {
  const dir = mk();
  try {
    w(dir, "docs/INDEX.md", "Boot: `src/gone.js::bootServer`.\n");
    const { findings } = verifyDocs(dir);
    assert.equal(findings.length, 1, JSON.stringify(findings));
    assert.equal(findings[0].kind, "missing-path");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("does not false-flag URLs, commands, or bare filenames", () => {
  const dir = mk();
  try {
    w(dir, "docs/INDEX.md", ["Build: `npm run build`.", "Site: [home](https://example.com).", "Config in `package.json`."].join("\n"));
    const { findings } = verifyDocs(dir);
    assert.equal(findings.length, 0, JSON.stringify(findings));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
