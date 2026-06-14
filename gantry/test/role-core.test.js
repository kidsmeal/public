"use strict";
/* Tests for role-core.js: config resolution, the implementer harness guard,
 * and invocation construction for external backends. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const CORE = path.join(
  __dirname, "..", "plugins", "gantry", "scripts", "role-core.js"
);
const core = require(CORE);

// --- parseConfig: fail SAFE to the native default ---

test("parseConfig returns DEFAULT_CONFIG for empty/null input", () => {
  assert.equal(core.parseConfig(""), core.DEFAULT_CONFIG);
  assert.equal(core.parseConfig(null), core.DEFAULT_CONFIG);
  assert.equal(core.parseConfig(undefined), core.DEFAULT_CONFIG);
});

test("parseConfig returns DEFAULT_CONFIG for malformed JSON", () => {
  assert.equal(core.parseConfig("{ not json !!"), core.DEFAULT_CONFIG);
});

test("parseConfig returns DEFAULT_CONFIG when roles or backends are missing", () => {
  assert.equal(core.parseConfig('{"roles":{}}'), core.DEFAULT_CONFIG);
  assert.equal(core.parseConfig('{"backends":{}}'), core.DEFAULT_CONFIG);
});

test("parseConfig returns the parsed object when well-formed", () => {
  const text = JSON.stringify({ roles: { x: {} }, backends: { y: {} } });
  const parsed = core.parseConfig(text);
  assert.deepEqual(parsed.roles, { x: {} });
  assert.deepEqual(parsed.backends, { y: {} });
});

// --- resolveRole: defaults / native ---

test("resolveRole resolves every default role to native dispatch", () => {
  for (const role of core.VALID_ROLES) {
    const r = core.resolveRole(core.DEFAULT_CONFIG, role);
    assert.equal(r.error, null, role + " should resolve without error");
    assert.equal(r.dispatch, "native");
    assert.equal(r.type, "native");
  }
});

test("resolveRole carries the native model tier through", () => {
  const r = core.resolveRole(core.DEFAULT_CONFIG, "implementer");
  assert.equal(r.model, "sonnet");
});

test("resolveRole falls back to the default assignment for a role absent from config", () => {
  // Config defines backends but omits phase-reviewer from roles.
  const cfg = { roles: {}, backends: { native: { type: "native" } } };
  const r = core.resolveRole(cfg, "phase-reviewer");
  assert.equal(r.error, null);
  assert.equal(r.type, "native");
});

test("resolveRole errors on an unknown role name", () => {
  const r = core.resolveRole(core.DEFAULT_CONFIG, "designer");
  assert.match(r.error, /unknown role/);
});

test("resolveRole errors when a role names an undefined backend", () => {
  const cfg = {
    roles: { "phase-reviewer": { backend: "ghost", model: "x" } },
    backends: { native: { type: "native" } },
  };
  const r = core.resolveRole(cfg, "phase-reviewer");
  assert.match(r.error, /not defined in backends/);
});

// --- resolveRole: the implementer harness guard (invariant #2) ---

test("implementer guard REJECTS a cli backend", () => {
  const cfg = {
    roles: { implementer: { backend: "codex", model: "gpt-5.5-codex" } },
    backends: {
      codex: { type: "cli", cmd: "codex exec --model {model}" },
    },
  };
  const r = core.resolveRole(cfg, "implementer");
  assert.ok(r.error, "should error");
  assert.match(r.error, /off-harness|harness/i);
});

test("implementer guard REJECTS an openai-compat backend", () => {
  const cfg = {
    roles: { implementer: { backend: "deepseek", model: "deepseek-chat" } },
    backends: { deepseek: { type: "openai-compat", provider: "deepseek" } },
  };
  const r = core.resolveRole(cfg, "implementer");
  assert.ok(r.error);
  assert.match(r.error, /harness/i);
});

test("implementer guard ALLOWS native", () => {
  const cfg = {
    roles: { implementer: { backend: "native", model: "opus" } },
    backends: { native: { type: "native" } },
  };
  const r = core.resolveRole(cfg, "implementer");
  assert.equal(r.error, null);
  assert.equal(r.type, "native");
});

test("implementer guard ALLOWS claude-headless (hooks fire in the harness)", () => {
  const cfg = {
    roles: { implementer: { backend: "kimi", model: "kimi-k2.6" } },
    backends: {
      kimi: {
        type: "claude-headless",
        base_url: "https://api.moonshot.ai/anthropic",
        env_key: "MOONSHOT_API_KEY",
      },
    },
  };
  const r = core.resolveRole(cfg, "implementer");
  assert.equal(r.error, null, "claude-headless brain-swap is harness-safe");
  assert.equal(r.dispatch, "external");
  assert.equal(r.type, "claude-headless");
});

test("the implementer harness-guard error is tagged harnessGuard (the one hard stop)", () => {
  const cfg = {
    roles: { implementer: { backend: "codex", model: "gpt-5.5-codex" } },
    backends: { codex: { type: "cli", cmd: "codex exec --model {model}" } },
  };
  const r = core.resolveRole(cfg, "implementer");
  assert.equal(r.harnessGuard, true);
});

test("an ordinary config error is NOT tagged harnessGuard (CLI then fails safe to native)", () => {
  const cfg = {
    roles: { "phase-reviewer": { backend: "ghost", model: "x" } },
    backends: { native: { type: "native" } },
  };
  const r = core.resolveRole(cfg, "phase-reviewer");
  assert.ok(r.error);
  assert.notEqual(r.harnessGuard, true);
});

test("an implementer with an UNKNOWN backend is an ordinary config error, not the harness guard", () => {
  // A typo'd backend is an accident (fail-safe to native), not a deliberate
  // off-harness choice (the hard stop). Only a well-formed off-harness backend
  // trips the guard.
  const cfg = {
    roles: { implementer: { backend: "typo", model: "x" } },
    backends: { native: { type: "native" } },
  };
  const r = core.resolveRole(cfg, "implementer");
  assert.ok(r.error);
  assert.notEqual(r.harnessGuard, true);
});

test("a NON-implementer role MAY use a cli backend", () => {
  const cfg = {
    roles: { "phase-reviewer": { backend: "codex", model: "gpt-5.5-codex" } },
    backends: {
      codex: {
        type: "cli",
        cmd: "codex exec --model {model} --sandbox {sandbox}",
        promptVia: "stdin",
      },
    },
  };
  const r = core.resolveRole(cfg, "phase-reviewer");
  assert.equal(r.error, null);
  assert.equal(r.dispatch, "external");
  assert.equal(r.model, "gpt-5.5-codex");
});

// --- resolveRole: model requirement for external backends ---

test("resolveRole errors (fail-safe, not harness guard) on an unknown backend type", () => {
  const cfg = {
    roles: { "phase-reviewer": { backend: "weird", model: "x" } },
    backends: { weird: { type: "frobnicate", model: "x" } },
  };
  const r = core.resolveRole(cfg, "phase-reviewer");
  assert.match(r.error, /unknown type/);
  assert.notEqual(r.harnessGuard, true);
});

test("an unknown backend type on the implementer is also an ordinary error (fail-safe to native)", () => {
  const cfg = {
    roles: { implementer: { backend: "weird", model: "x" } },
    backends: { weird: { type: "frobnicate", model: "x" } },
  };
  const r = core.resolveRole(cfg, "implementer");
  assert.match(r.error, /unknown type/);
  assert.notEqual(r.harnessGuard, true);
});

test("resolveRole errors when an external backend has no model", () => {
  const cfg = {
    roles: { "phase-reviewer": { backend: "codex" } },
    backends: { codex: { type: "cli", cmd: "codex exec" } },
  };
  const r = core.resolveRole(cfg, "phase-reviewer");
  assert.match(r.error, /requires a model/);
});

test("a backend-level model satisfies the model requirement", () => {
  const cfg = {
    roles: { "phase-reviewer": { backend: "codex" } },
    backends: { codex: { type: "cli", cmd: "codex exec", model: "gpt-5.5-codex" } },
  };
  const r = core.resolveRole(cfg, "phase-reviewer");
  assert.equal(r.error, null);
  assert.equal(r.model, "gpt-5.5-codex");
});

// --- expandCmd ---

test("expandCmd substitutes known tokens and leaves unknown ones intact", () => {
  const out = core.expandCmd("codex exec --model {model} --sandbox {sandbox} {unknown}", {
    model: "gpt-5.5-codex",
    sandbox: "read-only",
  });
  assert.equal(out, "codex exec --model gpt-5.5-codex --sandbox read-only {unknown}");
});

// --- stripFrontmatter / parseTools ---

test("stripFrontmatter removes a leading YAML block", () => {
  const md = "---\nname: phase-reviewer\ntools: Read, Bash\n---\n\nBody starts here.";
  assert.equal(core.stripFrontmatter(md).trim(), "Body starts here.");
});

test("stripFrontmatter is a no-op when there is no frontmatter", () => {
  assert.equal(core.stripFrontmatter("just a body"), "just a body");
});

test("parseTools reads the tools line into an array", () => {
  const md = "---\nname: implementer\ntools: Read, Edit, Write, Glob, Grep, Bash\nmodel: sonnet\n---\nbody";
  assert.deepEqual(core.parseTools(md), ["Read", "Edit", "Write", "Glob", "Grep", "Bash"]);
});

test("parseTools returns [] when no tools line exists", () => {
  assert.deepEqual(core.parseTools("---\nname: x\n---\nbody"), []);
});

// --- composePrompt ---

test("composePrompt appends a runtime inputs block", () => {
  const out = core.composePrompt("INSTRUCTIONS", "plan: p.md, phase: 2");
  assert.match(out, /INSTRUCTIONS/);
  assert.match(out, /Runtime inputs/);
  assert.match(out, /plan: p\.md, phase: 2/);
});

// --- buildInvocation ---

test("buildInvocation throws for a native descriptor", () => {
  const d = { type: "native", backend: { type: "native" } };
  assert.throws(() => core.buildInvocation(d, {}), /native/);
});

test("buildInvocation for codex cli pipes the prompt via stdin", () => {
  const d = core.resolveRole({
    roles: { "phase-reviewer": { backend: "codex", model: "gpt-5.5-codex" } },
    backends: {
      codex: {
        type: "cli",
        cmd: "codex exec --model {model} --sandbox {sandbox} --skip-git-repo-check",
        promptVia: "stdin",
        sandbox: "read-only",
      },
    },
  }, "phase-reviewer");
  const inv = core.buildInvocation(d, { prompt: "REVIEW THIS" });
  assert.deepEqual(inv.argv, [
    "codex", "exec", "--model", "gpt-5.5-codex",
    "--sandbox", "read-only", "--skip-git-repo-check",
  ]);
  assert.equal(inv.stdin, "REVIEW THIS");
});

test("buildInvocation for claude-headless pins --model, passes tools, and brain-swaps env", () => {
  const d = core.resolveRole({
    roles: { "phase-reviewer": { backend: "minimax", model: "MiniMax-M3" } },
    backends: {
      minimax: {
        type: "claude-headless",
        base_url: "https://api.minimax.io/anthropic",
        env_key: "MINIMAX_API_KEY",
      },
    },
  }, "phase-reviewer");
  const inv = core.buildInvocation(d, {
    prompt: "REVIEW",
    allowedTools: ["Read", "Glob", "Grep", "Bash"],
    authToken: "secret-token",
  });
  assert.deepEqual(inv.argv, [
    "claude", "-p", "--model", "MiniMax-M3",
    "--allowedTools", "Read,Glob,Grep,Bash",
  ]);
  assert.equal(inv.env.ANTHROPIC_BASE_URL, "https://api.minimax.io/anthropic");
  assert.equal(inv.env.ANTHROPIC_AUTH_TOKEN, "secret-token");
  assert.equal(inv.stdin, "REVIEW");
});

test("buildInvocation for claude-headless injects --settings when a settingsPath is given", () => {
  const d = core.resolveRole({
    roles: { implementer: { backend: "kimi", model: "kimi-k2.6" } },
    backends: {
      kimi: {
        type: "claude-headless",
        base_url: "https://api.moonshot.ai/anthropic",
        env_key: "MOONSHOT_API_KEY",
      },
    },
  }, "implementer");
  const inv = core.buildInvocation(d, {
    prompt: "BUILD",
    allowedTools: ["Read", "Edit", "Write", "Bash"],
    settingsPath: ".gantry/headless-implementer-settings.json",
  });
  assert.deepEqual(inv.argv, [
    "claude", "-p", "--model", "kimi-k2.6",
    "--settings", ".gantry/headless-implementer-settings.json",
    "--allowedTools", "Read,Edit,Write,Bash",
  ]);
  // The settings path is relative, so no argv element carries whitespace.
  for (const tok of inv.argv) {
    assert.ok(!/\s/.test(tok), "no argv element should contain whitespace: " + tok);
  }
});

test("buildGuardSettings wires both phase-enforcement guards as PreToolUse hooks", () => {
  const s = core.buildGuardSettings("/p/file-list-guard.js", "/p/commit-guard.js");
  const pre = s.hooks.PreToolUse;
  assert.equal(pre.length, 2);
  const edit = pre.find((h) => h.matcher === "Edit|Write|MultiEdit");
  const bash = pre.find((h) => h.matcher === "Bash");
  assert.match(edit.hooks[0].command, /file-list-guard\.js/);
  assert.match(bash.hooks[0].command, /commit-guard\.js/);
});

test("buildInvocation for openai-compat selects the provider by name (no spaces in argv)", () => {
  const d = core.resolveRole({
    roles: { "phase-reviewer": { backend: "deepseek", model: "deepseek-chat" } },
    backends: {
      deepseek: { type: "openai-compat", provider: "deepseek", sandbox: "read-only" },
    },
  }, "phase-reviewer");
  const inv = core.buildInvocation(d, { prompt: "REVIEW" });
  assert.deepEqual(inv.argv, [
    "codex", "exec", "--model", "deepseek-chat",
    "--sandbox", "read-only", "--skip-git-repo-check",
    "-c", "model_provider=deepseek",
  ]);
  for (const tok of inv.argv) {
    assert.ok(!/\s/.test(tok), "no argv element should contain whitespace: " + tok);
  }
  assert.equal(inv.stdin, "REVIEW");
});
