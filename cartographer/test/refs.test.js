"use strict";
/* Tests for the reference extractor (plugins/cartographer/scripts/refs.js). */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { extractRefs } = require("../plugins/cartographer/scripts/refs.js");

test("extracts a markdown link path and anchor", () => {
  const link = extractRefs("See [glossary](docs/GLOSSARY.md#token) for terms.").find((r) => r.kind === "link");
  assert.equal(link.path, "docs/GLOSSARY.md");
  assert.equal(link.anchor, "token");
});

test("extracts a backtick code-path that contains a slash", () => {
  const refs = extractRefs("Auth is in `src/auth/login.ts`.");
  assert.ok(refs.some((r) => r.kind === "code-path" && r.path === "src/auth/login.ts"));
});

test("skips URLs, bare filenames, and command snippets", () => {
  const refs = extractRefs(["[site](https://example.com)", "run `npm run build`", "see `package.json`"].join("\n"));
  assert.equal(refs.filter((r) => r.kind === "code-path").length, 0);
  assert.equal(refs.filter((r) => r.kind === "link").length, 0);
});

test("records the source line number", () => {
  const r = extractRefs("line one\nsee `a/b.md` here\n").find((x) => x.kind === "code-path");
  assert.equal(r.line, 2);
});

test("does not extract a path inside a fenced code block", () => {
  const text = "```\nsrc/app.js\n```\n";
  assert.equal(extractRefs(text).filter((r) => r.kind === "code-path").length, 0, "path inside fence should not be extracted");
});

test("extracts the same path when it appears inline in backticks outside a fence", () => {
  const text = "See `src/app.js` for details.\n";
  assert.ok(extractRefs(text).some((r) => r.kind === "code-path" && r.path === "src/app.js"), "inline code-path should be extracted");
});
