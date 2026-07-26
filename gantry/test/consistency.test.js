"use strict";
/* Consistency checks: the version lives in four files and the README's command
 * table must match commands/ - nothing keeps them honest except this test. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.join(__dirname, "..");
const PLUGIN = path.join(REPO, "plugins", "gantry");

function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function frontmatterVersion(p) {
  const m = fs.readFileSync(p, "utf8").match(/^version:\s*(\S+)\s*$/m);
  return m ? m[1] : null;
}

test("version matches across plugin.json, marketplace.json, and both skill frontmatters", () => {
  const version = readJson(path.join(PLUGIN, ".claude-plugin", "plugin.json")).version;
  assert.ok(version, "plugin.json must declare a version");

  const marketplace = readJson(path.join(REPO, ".claude-plugin", "marketplace.json"));
  assert.equal(marketplace.plugins[0].version, version, "marketplace.json version drifted from plugin.json");

  for (const skill of ["gantry", "design-plan-creator"]) {
    const p = path.join(PLUGIN, "skills", skill, "SKILL.md");
    assert.equal(frontmatterVersion(p), version, skill + "/SKILL.md frontmatter version drifted from plugin.json");
  }
});

test("every command in the README table exists in commands/, and vice versa", () => {
  const readme = fs.readFileSync(path.join(REPO, "README.md"), "utf8");
  const tableRows = readme.split("\n").filter((l) => /^\|\s*`\/gantry:/.test(l));
  const documented = new Set(
    tableRows.map((l) => l.match(/\/gantry:([a-z-]+)/)[1])
  );
  const shipped = new Set(
    fs.readdirSync(path.join(PLUGIN, "commands"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""))
  );

  for (const cmd of shipped) {
    assert.ok(documented.has(cmd), "commands/" + cmd + ".md is not in the README command table");
  }
  for (const cmd of documented) {
    assert.ok(shipped.has(cmd), "README documents /gantry:" + cmd + " but commands/" + cmd + ".md does not exist");
  }
});

test("phase-reviewer.md carries a Reachability check under Code discipline", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "phase-reviewer.md"), "utf8"
  );
  assert.ok(
    text.includes("Reachability"),
    "phase-reviewer.md must include a Reachability check"
  );
  assert.ok(
    text.includes("Wired-by"),
    "phase-reviewer.md Reachability section must reference Wired-by declarations"
  );
  assert.ok(
    /dead\s+code/i.test(text),
    "phase-reviewer.md must describe reachability as targeting silent dead code"
  );
});

test("phase-reviewer.md carries a real-input check under Test discipline", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "phase-reviewer.md"), "utf8"
  );
  assert.ok(
    text.includes("real-input"),
    "phase-reviewer.md must include a real-input check"
  );
  assert.ok(
    /fixture.only/i.test(text) || text.includes("fixture-only"),
    "phase-reviewer.md must state that fixture-only is insufficient for real-input code"
  );
});

test("phase-reviewer.md Hard rule carries the real-input smoke exception", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "phase-reviewer.md"), "utf8"
  );
  assert.ok(
    /real.input\s+smoke/i.test(text) || text.includes("real-input smoke"),
    "phase-reviewer.md Hard rules must include the real-input smoke exception"
  );
});

test("phase-reviewer.md verdict rules include reachability and real-input FAIL classes", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "phase-reviewer.md"), "utf8"
  );
  const verdictIdx = text.indexOf("Verdict rules:");
  assert.ok(verdictIdx !== -1, "phase-reviewer.md must contain a 'Verdict rules:' heading");
  const verdictBlock = text.slice(verdictIdx);
  assert.ok(
    verdictBlock.includes("Reachability"),
    "phase-reviewer.md verdict rules must reference Reachability"
  );
  assert.ok(
    verdictBlock.includes("real-input"),
    "phase-reviewer.md verdict rules section must reference real-input"
  );
});

test("phase-reviewer.md carries scope-calibration rule", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "phase-reviewer.md"), "utf8"
  );
  assert.ok(
    /scope.calibrat/i.test(text) || text.includes("scope-calibration") || text.includes("scope calibration"),
    "phase-reviewer.md must include a scope-calibration rule"
  );
  assert.ok(
    /deferred\s+note/i.test(text) || text.includes("deferred note"),
    "phase-reviewer.md scope-calibration must route beyond-phase demands to deferred notes"
  );
  assert.ok(
    /fix.now\s+note/i.test(text) || text.includes("fix-now note"),
    "phase-reviewer.md scope-calibration must route plan-omitted files to fix-now notes"
  );
});

test("phase-planner.md per-phase block includes the optional Wires/Wired-by field", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "phase-planner.md"), "utf8"
  );
  assert.ok(
    text.includes("Wires:"),
    "phase-planner.md must document the Wires: field form"
  );
  assert.ok(
    text.includes("Wired-by:"),
    "phase-planner.md must document the Wired-by: field form"
  );
  assert.ok(
    /per.phase/i.test(text) || text.includes("per-phase"),
    "phase-planner.md must describe the wiring field as per-phase (not a global section)"
  );
  assert.ok(
    /public\s+capability/i.test(text) || text.includes("public capability"),
    "phase-planner.md must scope the wiring field to phases that add a public capability"
  );
  // The field must live inside the per-phase block alongside Status/Goal/Files/Exit criteria,
  // not as a standalone section heading. Verify the block list includes it.
  assert.ok(
    /Status.*Goal.*Files/s.test(text),
    "phase-planner.md must still list Status / Goal / Files in its per-phase block"
  );
});

test("phase-planner.md wiring field documents all three Wired-by forms", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "phase-planner.md"), "utf8"
  );
  assert.ok(
    /Wired-by:\s+phase\s+\d/i.test(text) || text.includes("Wired-by: phase N") || /Wired-by: phase/.test(text),
    "phase-planner.md must document the 'Wired-by: phase N' form"
  );
  assert.ok(
    /Wired-by:\s+deferred/i.test(text) || text.includes("Wired-by: deferred"),
    "phase-planner.md must document the 'Wired-by: deferred (...)' form"
  );
  assert.ok(
    /Wired-by:\s+none/i.test(text) || text.includes("Wired-by: none"),
    "phase-planner.md must document the 'Wired-by: none (...)' form"
  );
});

test("implementer.md verification step carries the real-input rule", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "implementer.md"), "utf8"
  );
  assert.ok(
    text.includes("real-input") || text.includes("real input"),
    "implementer.md must include a real-input rule in its verification step"
  );
  assert.ok(
    /real\s+shipped\s+file/i.test(text) || text.includes("real shipped file") || text.includes("real shipped artifact"),
    "implementer.md real-input rule must require loading the real shipped file/artifact"
  );
  assert.ok(
    /fixture.only/i.test(text) || text.includes("fixture-only"),
    "implementer.md must state that fixture-only is insufficient for real-input code"
  );
});

test("implementer.md real-input rule names the browser/device fallback", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "implementer.md"), "utf8"
  );
  assert.ok(
    /browser|device/i.test(text),
    "implementer.md must name the browser/device fallback for the real-input rule"
  );
  assert.ok(
    /manual\s+real.input\s+check|stated\s+manual/i.test(text) || text.includes("manual real-input check") || text.includes("stated manual"),
    "implementer.md must describe the fallback as a stated manual real-input check"
  );
});

test("SKILL.md Stage 3 retains the 2 fix-and-re-review cycles cap unchanged", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "skills", "gantry", "SKILL.md"), "utf8"
  );
  assert.ok(
    text.includes("2 fix-and-re-review cycles"),
    "SKILL.md must retain the literal '2 fix-and-re-review cycles' cap value unchanged"
  );
});

test("review.md retains the 'up to 2 cycles' cap unchanged", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "commands", "review.md"), "utf8"
  );
  assert.ok(
    text.includes("up to 2 cycles"),
    "review.md must retain the literal 'up to 2 cycles' cap value unchanged"
  );
});

test("SKILL.md cap-hit escalation includes trajectory read", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "skills", "gantry", "SKILL.md"), "utf8"
  );
  assert.ok(
    text.includes("trajectory"),
    "SKILL.md cap-hit escalation must include a finding trajectory read"
  );
  assert.ok(
    /shrinking/i.test(text),
    "SKILL.md trajectory read must describe shrinking findings as a deep phase worth continuing"
  );
  assert.ok(
    /recurring/i.test(text),
    "SKILL.md trajectory read must describe recurring findings as stuck"
  );
});

test("SKILL.md cap-hit escalation presents the three options", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "skills", "gantry", "SKILL.md"), "utf8"
  );
  assert.ok(
    /keep\s+iterating/i.test(text),
    "SKILL.md cap-hit escalation must present the 'keep iterating' option"
  );
  assert.ok(
    /amend/i.test(text),
    "SKILL.md cap-hit escalation must present the 'amend the plan' option"
  );
  assert.ok(
    /overrule/i.test(text),
    "SKILL.md cap-hit escalation must present the 'overrule with a logged reason' option"
  );
});

test("SKILL.md cap-hit escalation states it never auto-passes", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "skills", "gantry", "SKILL.md"), "utf8"
  );
  assert.ok(
    /never\s+auto.pass|auto.pass/i.test(text),
    "SKILL.md must state that the cap-hit escalation never auto-passes"
  );
});

test("review.md cap-hit handling includes trajectory read and three options", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "commands", "review.md"), "utf8"
  );
  assert.ok(
    text.includes("trajectory"),
    "review.md cap-hit handling must include a finding trajectory read"
  );
  assert.ok(
    /keep\s+iterating/i.test(text),
    "review.md cap-hit handling must present the 'keep iterating' option"
  );
  assert.ok(
    /amend/i.test(text),
    "review.md cap-hit handling must present the 'amend the plan' option"
  );
  assert.ok(
    /overrule/i.test(text),
    "review.md cap-hit handling must present the 'overrule with a logged reason' option"
  );
});

// --- Phase 6: adversary final-pass in orchestrator docs + models.md schema ---

test("SKILL.md describes the adversary final-pass step after the primary clean verdict", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "skills", "gantry", "SKILL.md"), "utf8"
  );
  assert.ok(
    text.includes("adversary"),
    "SKILL.md must describe the adversary final-pass step"
  );
  assert.ok(
    text.includes("ADVERSARY"),
    "SKILL.md must reference the ADVERSARY: resolve output line"
  );
  assert.ok(
    text.includes("--adversary"),
    "SKILL.md must reference the 'run --adversary' invocation"
  );
});

test("SKILL.md adversary step covers the 'both clean' gate-open outcome", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "skills", "gantry", "SKILL.md"), "utf8"
  );
  assert.ok(
    /both\s+clean|both.*clean/i.test(text),
    "SKILL.md must state that the commit gate opens when both primary and adversary are clean"
  );
});

test("SKILL.md adversary step covers the fail-open rule when the backend is absent", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "skills", "gantry", "SKILL.md"), "utf8"
  );
  // The fail-open rule: adversary backend absent / non-zero exit -> warn and proceed to gate.
  assert.ok(
    /fail.open|fail open|non.zero|non-zero/i.test(text),
    "SKILL.md must describe the fail-open behavior when the adversary backend is absent or errors"
  );
});

test("SKILL.md adversary step states that with no adversary configured nothing fires", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "skills", "gantry", "SKILL.md"), "utf8"
  );
  assert.ok(
    /no adversary configured|adversary.*not configured|without.*adversary/i.test(text),
    "SKILL.md must state that with no adversary configured the pipeline is unchanged"
  );
});

test("review.md describes the adversary final-pass step and its outcomes", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "commands", "review.md"), "utf8"
  );
  assert.ok(
    text.includes("adversary"),
    "review.md must describe the adversary final-pass step"
  );
  assert.ok(
    text.includes("--adversary"),
    "review.md must reference the 'run --adversary' invocation"
  );
  assert.ok(
    /both\s+clean|both.*clean/i.test(text),
    "review.md must state that the commit gate opens when both primary and adversary are clean"
  );
});

test("review.md adversary step names the fail-open behavior", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "commands", "review.md"), "utf8"
  );
  assert.ok(
    /fail.open|fail open|non.zero|non-zero/i.test(text),
    "review.md must describe the fail-open behavior when the adversary backend is absent or errors"
  );
});

test("models.md documents the adversary object on a reviewer role", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "commands", "models.md"), "utf8"
  );
  assert.ok(
    text.includes("adversary"),
    "models.md must document the adversary config key"
  );
  // The opus-primary + codex-adversary example must be present.
  assert.ok(
    /opus|codex/i.test(text),
    "models.md must include an example showing the adversary (e.g. opus primary + codex adversary)"
  );
});

test("models.md states adversary is honored only on reviewer roles (ignored on implementer/planner)", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "commands", "models.md"), "utf8"
  );
  assert.ok(
    /reviewer\s+role|reviewer roles/i.test(text),
    "models.md must state adversary is honored only on reviewer roles"
  );
  assert.ok(
    /ignored|ignored with a warning|warning/i.test(text),
    "models.md must state adversary on implementer/planner is ignored with a warning"
  );
});

test("models.md states the design-reviewer adversary is parsed and shown but dormant", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "commands", "models.md"), "utf8"
  );
  assert.ok(
    /design.reviewer/i.test(text),
    "models.md must mention the design-reviewer adversary"
  );
  assert.ok(
    /dormant|v2|reserved/i.test(text),
    "models.md must state the design-reviewer adversary is dormant (reserved for v2)"
  );
});

// --- Re-review context: the orchestrator docs must carry the mechanism ---

test("review.md documents the re-review context mechanism", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "commands", "review.md"), "utf8"
  );
  assert.ok(
    text.includes("record-round"),
    "review.md must instruct recording the round before each fix relay"
  );
  assert.ok(
    text.includes("--context .gantry/review-round.json"),
    "review.md must pass the context flag on external re-reviews"
  );
  assert.ok(
    text.includes("show-round"),
    "review.md must use role.js show-round for native re-reviews"
  );
  assert.ok(
    /settled/i.test(text),
    "review.md must state that applied prior fixes are settled"
  );
  assert.ok(
    /NEW defect/.test(text),
    "review.md must state the NEW-defect reopening ground"
  );
  assert.ok(
    /round one|first review/i.test(text),
    "review.md must keep context out of first-round reviews"
  );
});

test("build.md fix-relay text records the round and re-reviews with context", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "commands", "build.md"), "utf8"
  );
  assert.ok(
    text.includes("record-round"),
    "build.md must mention recording the round on the fix-relay path"
  );
  assert.ok(
    text.includes("--context .gantry/review-round.json"),
    "build.md must mention the re-review context flag"
  );
});

test("SKILL.md Stage 3 re-review loop records rounds and passes context", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "skills", "gantry", "SKILL.md"), "utf8"
  );
  assert.ok(
    text.includes("record-round"),
    "SKILL.md must record the round before each fix relay"
  );
  assert.ok(
    text.includes("--context .gantry/review-round.json"),
    "SKILL.md must pass the context flag on external re-reviews"
  );
  assert.ok(
    text.includes("show-round"),
    "SKILL.md must use role.js show-round for native re-reviews"
  );
  assert.ok(
    /first review of a phase carries no context|never carries context/i.test(text),
    "SKILL.md must keep context out of first-round reviews"
  );
});

test("phase-reviewer.md documents the optional prior-rounds input and the settled rule", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "phase-reviewer.md"), "utf8"
  );
  assert.ok(
    text.includes("Prior review rounds"),
    "phase-reviewer.md must name the optional re-review context block"
  );
  assert.ok(
    /settled/i.test(text),
    "phase-reviewer.md must state that applied prior fixes are settled"
  );
  assert.ok(
    /NEW defect/.test(text),
    "phase-reviewer.md must state the NEW-defect reopening ground"
  );
});
