# Codebase Cartographer

A Claude Code plugin (and standalone skill) that documents a codebase. Point it at a repo and it produces:

- A codebase map (`docs/INDEX.md`) — entry points, modules and subsystems with their key files, the main data flow, and the build/run/test commands.
- A "Where things are" section wired into `CLAUDE.md` that links to the docs below.
- A glossary (`docs/GLOSSARY.md`) of project-specific terms.
- A roadmap (`docs/ROADMAP.md`) of active work — built with you through a few quick questions, since current/next/blocked work is the one thing it can't read from the code.
- A conventions doc (`docs/CONVENTIONS.md`) covering naming, layout, and idioms.

It reads the actual files before writing anything, verifies that every path it cites exists, and won't overwrite docs you already have. You can ask for the whole set or just one piece (for example, only the codebase map). On a large repo it splits the map into a slim index plus per-subsystem files so you only open the part you need.

The plugin also ships a trust layer, so the map fails loudly when it drifts instead of quietly going wrong:

- `verify.js` re-checks that every cited path, `#anchor`, and `path::symbol` citation still resolves. Symbol citations (used for entry points and golden-path hops) mean renaming an entry-point function breaks verification, not just moving its file.
- `drift.js` scores each doc section by section: how many commits have touched the files a `##` section cites since the doc was last committed. Labels are graded honestly — `ok` / `aging` / `probably stale` for churn (a proxy, not proof of wrongness), and `stale (broken refs)` only when verify caught a dead reference. It names the exact section to re-read instead of condemning a whole doc.
- An edit-time hook (PostToolUse) notes, once per file per session, when an agent edits a file the map cites: "docs/INDEX.md cites this file; check the map if you moved or renamed it." A note, never a block — no setup beyond installing the plugin.
- `slice.js <path-or-keyword>` prints just the map sections that cite a file or match a topic, as paste-ready markdown. An orchestrator briefs each subagent with one slice instead of letting N subagents each re-explore the repo.

### What it costs, what it pays back

The discovery pass is expensive by design — the skill reads real code before writing anything. That cost amortizes over agent traffic: every later session (and every subagent briefed with a slice) loads a few hundred tokens of map instead of re-deriving the structure, so a repo agents touch weekly pays the map back fast. A 20-file tool you visit twice a year may only need the CLAUDE.md block, and the skill already scales down to that honestly rather than manufacturing five docs.

## Install

Cartographer ships two ways — as a plugin (so it can travel with the [Compass Rose](../compass-rose/README.md) bundle) or as a single-file skill.

**1. As a plugin.** From its own marketplace:

```
git clone https://github.com/kidsmeal/public.git
/plugin marketplace add public/cartographer
/plugin install cartographer@cartographer
```

It is also bundled with Compass Rose — installing `compass@compass-rose` pulls Cartographer in as a dependency (see [compass-rose](../compass-rose/README.md)).

**2. As a single-file skill.** Download [`codebase-cartographer.skill`](codebase-cartographer.skill) and install it in Claude Code's skill installer — no plugin needed. The canonical form is the plugin directory at `plugins/cartographer/skills/codebase-cartographer/`; the `.skill` is a generated artifact. To regenerate it after editing the plugin, run `node tools/build-skill.js` from the `cartographer/` directory (requires Python 3, already needed for `scan_repo.py`).

Either way, restart Claude Code (or run `/reload-plugins`) so it picks the skill up.

## Use

Once installed, ask in plain language — for example:

- "map this codebase"
- "set up CLAUDE.md so it knows the layout"
- "I inherited this repo and don't know where anything is"
- "just make a codebase map under docs/"

The skill scans the repo, shows you a proposed structure, then writes the docs after you confirm.

## Layout

```
cartographer/
├── codebase-cartographer.skill              # the same skill packaged as a single installable file
└── plugins/cartographer/
    ├── .claude-plugin/plugin.json
    ├── hooks/
    │   ├── hooks.json                    # registers the edit-time note below
    │   └── cited-file-note.js            # PostToolUse: "the map cites the file you just edited"
    ├── templates/
    │   └── ROADMAP.md                    # roadmap scaffold in the structured row schema (Compass-compatible)
    ├── scripts/
    │   ├── refs.js                       # shared reference extractor (paths, #anchors, ::symbols)
    │   ├── docs.js                       # shared standing-doc discovery + section splitting
    │   ├── verify.js                     # re-checks every cited path + #anchor + ::symbol still resolves
    │   ├── drift.js                      # per-section drift scoring with graded labels (git)
    │   └── slice.js                      # prints the map sections relevant to a file/topic, for subagent briefing
    └── skills/codebase-cartographer/
        ├── SKILL.md                         # the skill itself (workflow + rules)
        ├── references/
        │   ├── codebase_map_guide.md        # how the codebase map is structured
        │   ├── satellite_docs.md            # templates for glossary/roadmap/conventions/CLAUDE.md
        │   └── discovery_playbook.md        # per-language hints for finding entry points and modules
        └── scripts/
            └── scan_repo.py                 # repo inventory scanner (Python 3.8+, no dependencies)
```

## Requirements

- Claude Code.
- Python 3.8+ for `scan_repo.py` (optional — the skill works without it, the scanner just speeds up the first pass).

## License

MIT. See [LICENSE](LICENSE).
