# Codebase Cartographer

A Claude Code plugin (and standalone skill) that documents a codebase. Point it at a repo and it produces:

- A codebase map (`docs/INDEX.md`) — entry points, modules and subsystems with their key files, the main data flow, and the build/run/test commands.
- A "Where things are" section wired into `CLAUDE.md` that links to the docs below.
- A glossary (`docs/GLOSSARY.md`) of project-specific terms.
- A roadmap (`docs/ROADMAP.md`) of active work — built with you through a few quick questions, since current/next/blocked work is the one thing it can't read from the code.
- A conventions doc (`docs/CONVENTIONS.md`) covering naming, layout, and idioms.

It reads the actual files before writing anything, verifies that every path it cites exists, and won't overwrite docs you already have. You can ask for the whole set or just one piece (for example, only the codebase map). On a large repo it splits the map into a slim index plus per-subsystem files so you only open the part you need.

## Install

Cartographer ships two ways — as a plugin (so it can travel with the [Compass Rose](../compass-rose/README.md) bundle) or as a single-file skill.

**1. As a plugin.** From its own marketplace:

```
git clone https://github.com/kidsmeal/public.git
/plugin marketplace add public/cartographer
/plugin install cartographer@cartographer
```

It is also bundled with Compass Rose — installing `compass@compass-rose` pulls Cartographer in as a dependency (see [compass-rose](../compass-rose/README.md)).

**2. As a single-file skill.** Download [`codebase-cartographer.skill`](codebase-cartographer.skill) and install it in Claude Code's skill installer — no plugin needed.

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
