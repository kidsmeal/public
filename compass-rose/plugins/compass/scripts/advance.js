#!/usr/bin/env node
/*
 * Compass Rose advance — deterministic pipeline dispatcher.
 *
 * Reads the roadmap row tuple (status, active_phase, phase_state) plus cheap
 * git evidence and names the single next step, the expected gate, and the
 * prescribed row transition. The model executes and narrates; this script decides.
 *
 * Usage:
 *   node advance.js [--id <row-id>] [--phase N]
 *   node advance.js --apply [--id <row-id>] [--phase N]
 *   node advance.js --apply --id X --set key=value [--set key=value ...]
 *
 * --apply writes the prescribed transition to ROADMAP.md.
 * --set overrides the prescribed fields (for fail/exceptional cases).
 *
 * COMPASS_PROJECT_DIR (or CLAUDE_PROJECT_DIR, or cwd) is the project root.
 */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { parseRoadmap, findById, activeFeature, setFields } = require("./roadmap.js");

const ROOT = process.env.COMPASS_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd();

// --- arg parsing ---
const argv = process.argv.slice(2);
let rowId = null;
let phaseOverride = null;
let applyMode = false;
const explicitFields = {};

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--id" && argv[i + 1]) { rowId = argv[++i]; continue; }
  if (argv[i] === "--phase" && argv[i + 1]) { phaseOverride = parseInt(argv[++i], 10); continue; }
  if (argv[i] === "--apply") { applyMode = true; continue; }
  if (argv[i] === "--set" && argv[i + 1]) {
    const eq = argv[++i].indexOf("=");
    if (eq !== -1) explicitFields[argv[i].slice(0, eq).toLowerCase()] = argv[i].slice(eq + 1);
    continue;
  }
}

// --- helpers ---
function git(args) {
  try {
    return execFileSync("git", ["-C", ROOT, ...args], {
      encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch { return ""; }
}
function read(rel) { try { return fs.readFileSync(path.join(ROOT, rel), "utf8"); } catch { return ""; } }
function exists(rel) { try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; } }
function firstExisting(cands) { return cands.find(exists) || null; }

// Count the highest ## Phase N heading in a plan file. Returns null if unresolvable.
function countPlanPhases(rel) {
  if (!rel) return null;
  const txt = read(rel);
  if (!txt) return null;
  const nums = (txt.match(/^##\s+Phase\s+(\d+)/gmi) || []).map((m) => parseInt(m.match(/\d+/)[0], 10));
  return nums.length ? Math.max(...nums) : null;
}

// --- load roadmap ---
const rmFile = firstExisting(["docs/ROADMAP.md", "ROADMAP.md"]);
if (!rmFile) {
  console.log("No ROADMAP.md in this project. Structured state is absent; /compass:advance falls back to prose.");
  process.exit(0);
}

let rm;
try { rm = parseRoadmap(read(rmFile)); } catch {
  console.log("Could not parse " + rmFile + ". Structured state is absent; /compass:advance falls back to prose.");
  process.exit(0);
}
if (!rm.schemaPresent) {
  console.log(rmFile + " has no schema rows. Structured state is absent; /compass:advance falls back to prose.");
  process.exit(0);
}

const f = rowId ? findById(rm, rowId) : activeFeature(rm);
if (!f) {
  const msg = rowId ? "Row '" + rowId + "' not found in " + rmFile + "." : "No in_progress row or queued Now row.";
  console.log("No active feature found. " + msg);
  process.exit(0);
}

// --- gather evidence ---
const porcelain = git(["status", "--porcelain"]);
const CURSOR = new Set(["NOW.md", "IDEAS.md", "SHIPPED.md"]);
const realChanges = porcelain.split("\n").filter(Boolean).filter((l) => {
  const fn = l.slice(3).trim();
  return !CURSOR.has(fn) && !fn.startsWith(".now/") && !fn.startsWith(".compass/");
});
const treeDirty = realChanges.length > 0;
const designExists = f.design ? exists(f.design) : false;
const planExists = f.plan ? exists(f.plan) : false;

// --- decision table ---
const status = f.status || null;
const activePhase = f.activePhase > 0 ? f.activePhase : 1;
const phase = phaseOverride !== null ? phaseOverride : activePhase;
const phaseState = f.phaseState || null;
const lane = f.lane || "full";

let nextStep, command, gate, transition;

if (status === "idea" || status === "designing" ||
    (lane === "full" && !f.design && !["in_progress", "blocked", "done"].includes(status))) {
  nextStep = "PROMOTE — author or finish the design with /compass:promote.";
  command = "/compass:promote";
  gate = "HUMAN DECISION REQUIRED";
  transition = null;
} else if (status === "designed" || status === "planning" || (!f.plan && !["in_progress", "blocked", "done"].includes(status))) {
  nextStep = "PLAN — run /gantry:plan on the design to produce a phased plan.";
  command = "/gantry:plan " + (f.design || "");
  gate = "SAFE TO ADVANCE";
  transition = { status: "planned", active_phase: "0" };
} else if (status === "planned" || (lane === "small" && f.plan && status !== "in_progress" && status !== "done")) {
  const bp = phaseOverride !== null ? phaseOverride : 1;
  nextStep = "BUILD — implement phase " + bp + " with /gantry:build.";
  command = "/gantry:build " + (f.plan || "") + " " + bp;
  gate = "SAFE TO ADVANCE";
  transition = { status: "in_progress", active_phase: String(bp), phase_state: "building" };
} else if (status === "in_progress") {
  if (!phaseState || phaseState === "building") {
    nextStep = "BUILD — continue or finish phase " + phase + ".";
    command = "/gantry:build " + (f.plan || "") + " " + phase;
    gate = "SAFE TO ADVANCE";
    transition = { phase_state: "in_review" };
  } else if (phaseState === "in_review") {
    nextStep = "REVIEW — run /gantry:review on the uncommitted diff.";
    command = "/gantry:review " + (f.plan || "") + " " + phase;
    gate = "SAFE TO ADVANCE";
    transition = { phase_state: "ready_to_commit" };
  } else if (phaseState === "review_failed") {
    nextStep = "BUILD — fix the review findings for phase " + phase + ", then re-review.";
    command = "/gantry:build " + (f.plan || "") + " " + phase;
    gate = "REVIEW FAILED";
    transition = { phase_state: "in_review" };
  } else if (phaseState === "ready_to_commit") {
    nextStep = "WAIT FOR COMMIT — phase " + phase + " passed review. Commit when ready.";
    command = "(commit the diff — gate is yours)";
    gate = "COMMIT REQUIRED";
    transition = null;
  } else if (phaseState === "committed") {
    const lastPhase = countPlanPhases(f.plan);
    if (lastPhase === null) {
      nextStep = "ADVANCE — phase " + phase + " committed. Cannot count phases (plan unresolvable); mark done manually if this was the last phase.";
      command = "/compass:advance --apply --id " + f.id;
      gate = "SAFE TO ADVANCE";
      transition = { active_phase: String(phase + 1), phase_state: "building" };
    } else if (phase >= lastPhase) {
      nextStep = "ADVANCE — all " + lastPhase + " phase(s) committed. Mark the row done.";
      command = "/compass:advance --apply --id " + f.id;
      gate = "SAFE TO ADVANCE";
      transition = { status: "done", phase_state: "—" };
    } else {
      const next = phase + 1;
      nextStep = "ADVANCE — phase " + phase + " committed. Start phase " + next + ".";
      command = "/compass:advance --apply --id " + f.id;
      gate = "SAFE TO ADVANCE";
      transition = { active_phase: String(next), phase_state: "building" };
    }
  } else {
    nextStep = "UNKNOWN phase_state '" + phaseState + "' — check the row manually.";
    command = "(review the roadmap row)";
    gate = "HUMAN DECISION REQUIRED";
    transition = null;
  }
} else if (status === "blocked") {
  nextStep = "UNBLOCK — resolve the blocker." + (f.blockedBy ? " Blocked by: " + f.blockedBy : "");
  command = "(resolve the blocker, then restore the prior status)";
  gate = "BLOCKED";
  transition = null;
} else if (status === "done") {
  nextStep = "NOTHING — this row is done. Suggest /claudhd:shipped if not yet logged.";
  command = "/claudhd:shipped";
  gate = "SAFE TO ADVANCE";
  transition = null;
} else {
  nextStep = "UNKNOWN status '" + (status || "null") + "' — check the row manually.";
  command = "(review the roadmap row)";
  gate = "HUMAN DECISION REQUIRED";
  transition = null;
}

// --- conflict detection (report-only; overrides gate to HUMAN DECISION REQUIRED) ---
// Tree-state conflicts: ready_to_commit fires unconditionally (suspicious in any
// environment). building/in_review and committed only fire when git is available,
// because without a repo the tree always looks clean (false positive).
const inGitRepo = !!git(["rev-parse", "--git-dir"]);
const conflicts = [];
if (inGitRepo && phaseState === "ready_to_commit" && !treeDirty) {
  conflicts.push("ready_to_commit but tree is clean — may already be committed");
}
if (inGitRepo && phaseState === "committed" && treeDirty) {
  conflicts.push("committed but tree is dirty — unknown work in flight");
}
if (inGitRepo && (phaseState === "building" || phaseState === "in_review") && !treeDirty) {
  conflicts.push(phaseState + " but tree is clean — nothing actually built yet");
}
if (f.design && !designExists && ["designing", "designed", "planning", "planned", "in_progress", "done"].includes(status)) {
  conflicts.push("design link " + f.design + " missing on disk");
}
if (f.plan && !planExists && ["planned", "in_progress", "done"].includes(status)) {
  conflicts.push("plan link " + f.plan + " missing on disk");
}
if (conflicts.length > 0) gate = "HUMAN DECISION REQUIRED";

// --- output ---
console.log("--- compass: advance ---");
console.log("");
console.log("Position:");
console.log("  id:         " + f.id);
console.log("  title:      " + f.name);
console.log("  status:     " + (status || "—"));
console.log("  phase:      " + f.activePhase + (phaseState ? " / " + phaseState : ""));
console.log("  lane:       " + lane);

console.log("");
console.log("Evidence:");
console.log("  tree:       " + (treeDirty ? "dirty (" + realChanges.length + " file(s))" : "clean"));
console.log("  design:     " + (f.design ? f.design + (designExists ? " (ok)" : " (MISSING)") : "—"));
console.log("  plan:       " + (f.plan ? f.plan + (planExists ? " (ok)" : " (MISSING)") : "—"));

if (conflicts.length > 0) {
  console.log("");
  console.log("Conflicts:");
  for (const c of conflicts) console.log("  ! " + c);
}

console.log("");
console.log("Next step:   " + nextStep);
console.log("Command:     " + command);
console.log("Gate:        === GATE: " + gate + " ===");
if (transition) {
  const pairs = Object.entries(transition).map(([k, v]) => k + ": " + (v == null ? "—" : v)).join(", ");
  console.log("Transition:  " + pairs);
} else {
  const why = gate === "COMMIT REQUIRED" ? "gate by commit" : gate === "BLOCKED" ? "blocked" : gate === "HUMAN DECISION REQUIRED" ? "human decision" : "row is done";
  console.log("Transition:  (none — " + why + ")");
}

// --- apply mode ---
if (applyMode) {
  const fieldsToWrite = Object.keys(explicitFields).length > 0 ? explicitFields : transition;
  if (!fieldsToWrite || Object.keys(fieldsToWrite).length === 0) {
    console.log("\n(--apply: no transition to write for this state)");
    process.exit(0);
  }
  const rmPath = path.join(ROOT, rmFile);
  const txt = read(rmFile);
  const updated = setFields(txt, f.id, fieldsToWrite);
  if (updated === null) {
    console.error("! advance --apply: row '" + f.id + "' not found in " + rmFile);
    process.exit(1);
  }
  fs.writeFileSync(rmPath, updated);
  const applied = Object.entries(fieldsToWrite).map(([k, v]) => k + "=" + (v == null ? "—" : v)).join(", ");
  console.log("\nApplied: " + applied + " -> " + rmFile);
}
