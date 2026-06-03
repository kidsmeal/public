#!/usr/bin/env node
/*
 * Compass Rose roadmap parser - the structured read of the project ROADMAP.
 *
 * The roadmap row is the single source of truth for a feature's state (status,
 * active_phase, phase_state) and its links (idea / design / plan). This module
 * turns the Markdown into structured rows so commands (status, doctor, advance)
 * reason over data instead of interpreting prose.
 *
 * It degrades gracefully (design principle 6): a roadmap with no schema fields
 * still parses, with schemaPresent=false, so callers can fall back to prose.
 * Fenced code blocks are skipped, so example rows in docs are never parsed as
 * real state.
 *
 * Used as a module (require) by other compass scripts, or as a CLI for debugging:
 *   node roadmap.js [path-to-ROADMAP.md]
 */
"use strict";
const fs = require("fs");
const path = require("path");

const STATUSES = ["idea", "designing", "designed", "planning", "planned", "in_progress", "blocked", "done"];
const PHASE_STATES = ["building", "in_review", "review_failed", "ready_to_commit", "committed"];
const FIELD_KEYS = ["status", "active_phase", "phase_state", "idea", "design", "plan", "blocked_by"];
// Statuses at or past which a design and plan are expected to exist.
const PLANNED_OR_LATER = ["planned", "in_progress", "done"];

// Treat —, -, none, n/a, empty as "no value".
function nullish(v) {
  if (v == null) return true;
  const s = String(v).trim().toLowerCase();
  return s === "" || s === "—" || s === "-" || s === "none" || s === "n/a";
}
function clean(v) { return nullish(v) ? null : String(v).trim(); }
function kebab(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// Parse roadmap markdown into structured feature rows.
function parseRoadmap(text) {
  const lines = String(text || "").split(/\r?\n/);
  const features = [];
  let section = null;
  let inFence = false;
  let cur = null;
  let sawField = false;

  const itemRe = /^- \[( |x|X)\]\s+(.*)$/;
  const fieldRe = /^\s+-\s+([a-z_]+):\s*(.*)$/;
  const headingRe = /^##\s+(.*)$/;
  const fenceRe = /^\s*```/;

  const push = () => { if (cur) { features.push(cur); cur = null; } };

  for (const line of lines) {
    if (fenceRe.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;

    const h = line.match(headingRe);
    if (h) { push(); section = h[1].trim(); continue; }

    const it = line.match(itemRe);
    if (it) {
      push();
      const checked = it[1].toLowerCase() === "x";
      const rest = it[2];
      const idm = rest.match(/<!--\s*id:\s*([a-z0-9-]+)\s*-->/i);
      const name = rest.replace(/<!--.*?-->/g, "").trim();
      cur = {
        id: idm ? idm[1] : kebab(name),
        name,
        checked,
        section,
        status: null,
        activePhase: 0,
        phaseState: null,
        idea: null,
        design: null,
        plan: null,
        blockedBy: null,
        unknownStatus: false,
        raw: {},
      };
      continue;
    }

    if (cur) {
      const f = line.match(fieldRe);
      if (f && FIELD_KEYS.includes(f[1].toLowerCase())) {
        const key = f[1].toLowerCase();
        const val = f[2];
        sawField = true;
        cur.raw[key] = val.trim();
        switch (key) {
          case "status": {
            const s = clean(val);
            cur.status = s ? s.toLowerCase() : null;
            if (cur.status && !STATUSES.includes(cur.status)) cur.unknownStatus = true;
            break;
          }
          case "active_phase": {
            const n = parseInt(clean(val) || "0", 10);
            cur.activePhase = Number.isFinite(n) ? n : 0;
            break;
          }
          case "phase_state": { const s = clean(val); cur.phaseState = s ? s.toLowerCase() : null; break; }
          case "idea": cur.idea = clean(val); break;
          case "design": cur.design = clean(val); break;
          case "plan": cur.plan = clean(val); break;
          case "blocked_by": cur.blockedBy = clean(val); break;
        }
      }
    }
  }
  push();

  return { features, schemaPresent: sawField };
}

function findById(roadmap, id) {
  return roadmap.features.find((f) => f.id === id) || null;
}

// The single live feature: the in_progress one, else the first non-done,
// unchecked row under a "Now" section.
function activeFeature(roadmap) {
  const inProg = roadmap.features.find((f) => f.status === "in_progress");
  if (inProg) return inProg;
  return roadmap.features.find(
    (f) => f.section && /now/i.test(f.section) && f.status !== "done" && !f.checked
  ) || null;
}

// Cheap structural lint. /compass:doctor expands on this with git/file checks.
function lint(roadmap) {
  const issues = [];
  for (const f of roadmap.features) {
    if (f.unknownStatus) issues.push({ id: f.id, level: "warn", msg: `unknown status "${f.raw.status}"` });
    const planned = PLANNED_OR_LATER.includes(f.status);
    if (planned && !f.design) issues.push({ id: f.id, level: "warn", msg: `status "${f.status}" but no design link` });
    if (planned && !f.plan) issues.push({ id: f.id, level: "warn", msg: `status "${f.status}" but no plan link` });
    if (f.status === "in_progress" && !f.phaseState) issues.push({ id: f.id, level: "warn", msg: "in_progress but no phase_state" });
    if (f.status === "blocked" && !f.blockedBy) issues.push({ id: f.id, level: "info", msg: "blocked but no blocked_by reason" });
  }
  return issues;
}

module.exports = { parseRoadmap, findById, activeFeature, lint, STATUSES, PHASE_STATES, FIELD_KEYS };

// CLI: dump parsed state for debugging / for a quick eyeball.
if (require.main === module) {
  const ROOT = process.env.COMPASS_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const arg = process.argv[2];
  const candidates = arg ? [arg] : [path.join(ROOT, "docs", "ROADMAP.md"), path.join(ROOT, "ROADMAP.md")];
  const file = candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
  if (!file) { console.log("No ROADMAP.md found. Looked at: " + candidates.join(", ")); process.exit(0); }
  const rm = parseRoadmap(fs.readFileSync(file, "utf8"));
  console.log("Roadmap: " + file + "  (schema " + (rm.schemaPresent ? "present" : "absent - prose fallback") + ")");
  console.log("Features: " + rm.features.length);
  for (const f of rm.features) {
    console.log(`  [${f.section || "?"}] ${f.id}  status=${f.status || "-"} phase=${f.activePhase}/${f.phaseState || "-"}` +
      (f.design ? "  design✓" : "") + (f.plan ? "  plan✓" : "") + (f.blockedBy ? `  blocked:${f.blockedBy}` : ""));
  }
  const issues = lint(rm);
  if (issues.length) {
    console.log("\nLint:");
    for (const i of issues) console.log(`  [${i.level}] ${i.id}: ${i.msg}`);
  }
}
