"use strict";
/* Tests for the shared standing-doc helpers (plugins/cartographer/scripts/docs.js). */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { splitSections } = require("../plugins/cartographer/scripts/docs.js");

test("a doc with no ## headings is a single heading-less section", () => {
  const s = splitSections("# Title\nline two\nline three\n");
  assert.equal(s.length, 1);
  assert.equal(s[0].heading, null);
  assert.equal(s[0].startLine, 1);
});

test("splits at ## headings, keeping the preamble and 1-based line ranges", () => {
  const s = splitSections(["# Title", "intro", "## One", "a", "## Two", "b"].join("\n"));
  assert.deepEqual(s.map((x) => x.heading), [null, "One", "Two"]);
  assert.equal(s[0].startLine, 1); assert.equal(s[0].endLine, 2);
  assert.equal(s[1].startLine, 3); assert.equal(s[1].endLine, 4);
  assert.equal(s[2].startLine, 5); assert.equal(s[2].endLine, 6);
  assert.match(s[1].text, /## One\na/);
});

test("a ## inside a fenced code block does not split", () => {
  const s = splitSections(["## Real", "```", "## not a heading", "```", "tail"].join("\n"));
  assert.equal(s.length, 1);
  assert.equal(s[0].heading, "Real");
});

test("deeper headings (###) do not split", () => {
  const s = splitSections(["## One", "### sub", "x"].join("\n"));
  assert.equal(s.length, 1);
});
