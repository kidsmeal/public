#!/usr/bin/env node
/*
 * Compass Rose init - the /compass:init command.
 *
 * Compass Rose is a connector: it does not re-run the three instruments' own
 * setup, and it owns no state of its own. This script reports where each
 * instrument stands in THIS project and the seam files the connector commands
 * will read, so the command can guide the ordered setup. Read-only.
 *
 * (The quick-fixes lane is owned by ClauDHD natively - /claudhd:init scaffolds it
 * and /claudhd:quick manages it - so Compass Rose never touches NOW.md.)
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = process.env.COMPASS_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd();

function exists(rel) { try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; } }
function firstExisting(cands) { return cands.find(exists) || null; }

// Per-instrument artifacts in this project.
const map = firstExisting(["docs/INDEX.md", "INDEX.md"]);
const roadmap = firstExisting(["docs/ROADMAP.md", "ROADMAP.md"]);
const conventions = firstExisting(["CONVENTIONS.md", "docs/CONVENTIONS.md", "AGENTS.md", "CLAUDE.md"]);
const glossary = firstExisting(["docs/GLOSSARY.md", "GLOSSARY.md"]);
const now = exists("NOW.md");
const audit = firstExisting(["CURRENTNESS_AUDIT.md", "docs/CURRENTNESS_AUDIT.md"]);
const rvq = firstExisting(["RUNTIME_VERIFICATION_QUEUE.md", "docs/RUNTIME_VERIFICATION_QUEUE.md"]);

const cartographerReady = !!map;
const claudhdReady = now;
const gantryReady = !!(audit || rvq);

function mark(ok) { return ok ? "[ready]  " : "[missing]"; }

console.log("Compass Rose init - connector status for this project\n");
console.log("Instruments:");
console.log("  " + mark(cartographerReady) + " Cartographer (the chart)   " +
  (cartographerReady ? "map: " + map : "run the codebase-cartographer skill: \"map this codebase\""));
console.log("  " + mark(claudhdReady) + " ClauDHD (dead reckoning)   " +
  (claudhdReady ? "cursor: NOW.md (quick fixes: /claudhd:quick)" : "run /claudhd:init"));
console.log("  " + mark(gantryReady) + " Gantry (the dock)          " +
  (gantryReady ? "audit: " + (audit || rvq) : "run /gantry:init"));

console.log("\nSeam files (read by the connector commands):");
console.log("  map index   : " + (map || "(none - /compass:promote will design from the code directly)"));
console.log("  glossary    : " + (glossary || "(none)"));
console.log("  conventions : " + (conventions || "(none - Gantry will fall back to matching the surrounding code)"));
console.log("  roadmap     : " + (roadmap || "(none - build one with the cartographer skill)"));

const order = [];
if (!cartographerReady) order.push("map the codebase (cartographer skill)");
if (!claudhdReady) order.push("/claudhd:init");
if (!gantryReady) order.push("/gantry:init");
if (order.length) {
  console.log("\nTo finish bootstrapping, in order: " + order.join("  ->  "));
} else {
  console.log("\nAll three instruments are initialized. The pipeline is wired.");
}
