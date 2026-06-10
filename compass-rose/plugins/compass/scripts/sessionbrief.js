#!/usr/bin/env node
/*
 * Compass Rose session brief - SessionStart hook.
 *
 * Prints at most two lines when a compass project is open and there is active
 * work. Dead silent everywhere else. Budget: no cartographer invocations, at
 * most two cheap git calls, fail soft on everything.
 */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { parseRoadmap, activeFeature, lint } = require("./roadmap.js");

const ROOT = process.env.COMPASS_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd();

function git(args) {
  try {
    return execFileSync("git", ["-C", ROOT, ...args], {
      encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch { return ""; }
}
function exists(rel) { try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; } }
function read(rel) { try { return fs.readFileSync(path.join(ROOT, rel), "utf8"); } catch { return ""; } }
function firstExisting(cands) { return cands.find(exists) || null; }

const rmFile = firstExisting(["docs/ROADMAP.md", "ROADMAP.md"]);
if (!rmFile) process.exit(0);

let rm;
try { rm = parseRoadmap(read(rmFile)); } catch { process.exit(0); }
if (!rm.schemaPresent) process.exit(0);

const active = activeFeature(rm);
if (!active) process.exit(0);

// Line 1: position of the active feature
const tuple = [active.status || "—", active.activePhase, active.phaseState || "—"].join("/");
console.log("compass: " + active.name + " [" + active.id + "] - " + tuple);

// Line 2: one signal if warranted — blocked rows OR a lint issue count (one git call)
const blocked = rm.features.filter((f) => f.status === "blocked");
if (blocked.length > 0) {
  console.log("blocked: " + blocked.length + " row(s) — " + blocked.map((f) => f.id).join(", "));
  process.exit(0);
}

const issues = lint(rm).filter((i) => i.level === "warn");
if (issues.length > 0) {
  console.log("roadmap: " + issues.length + " lint warning(s) — run /compass:doctor");
  process.exit(0);
}

// Lite commit-age check: has the roadmap gone untouched for 20+ commits? (one git call)
const lastTouch = git(["log", "-1", "--format=%H", "--", rmFile]);
if (lastTouch) {
  const behindCount = git(["rev-list", "--count", lastTouch + "..HEAD"]);
  const behind = behindCount ? parseInt(behindCount, 10) : 0;
  if (behind >= 20) {
    console.log("roadmap: " + behind + " commits since last update — may be stale");
  }
}

process.exit(0);
