# AGENTS.md

Instructions for any coding agent (Claude Code, Codex, Cursor, …) working in this repo. Read this first, then the files it points to.

## What this is

**Your Kind of Cruise** (formerly Cruise Cabin Finder): a public, static site that compares cruise **ship × cabin tier** combinations by **all-in price per person per night**, cabin-tier perks, ship size and amenities. Three modes (Simple, Detailed, Help me choose) share one engine. Hosted on GitHub Pages from `docs/`.

## Read next

| File | What it holds |
|---|---|
| [`agents/decisions.md`](agents/decisions.md) | **Every product decision made with the owner, with reasons. Do not reverse one without asking.** |
| [`agents/conventions.md`](agents/conventions.md) | Data rules, code rules, copy rules, git workflow |
| [`agents/research.md`](agents/research.md) | Research findings and sources behind the decisions |
| [`roadmap.md`](roadmap.md) | Spec: data model, pricing formula, filters, modes, milestones, risks |
| [`README.md`](README.md) | Commands |

## Non-negotiables (short version)

1. **Ask before reversing a decision** in `agents/decisions.md`. Add new decisions there (next D-number) and in `roadmap.md` §2 when the owner makes them.
2. **Unknown ≠ No.** Blank means unknown. Never write `0` for "didn't check".
3. **Every curated fact row has `source_urls` and `last_verified`.** Official line pages beat blogs; forums are leads only.
4. **Never hand-edit build outputs** (`data/dataset.json`, `data/dataset.csv`, `docs/data.json`). Edit `data/curated/*.csv`, then run `python3 scripts/build.py`.
5. **No scraping CruisePlum.** Its robots.txt disallows `/data/` and it sits behind a Cloudflare challenge. The owner exports manually. Publish only derived medians; raw exports go in gitignored `data/raw/`.
6. **Before every commit:** `python3 scripts/build.py --check`, `python3 -m unittest discover -s tests`, `ruff check scripts tests`, `ruff format --check scripts tests`, and `aislop scan` (pinned 0.19.1) must all pass.
7. **Commit to `main` as work lands** (owner's instruction), with the session's attribution trailer.
8. **The owner prefers:** research before stating facts, a clear recommendation first, being challenged, concise bullet answers, Python for analysis, and being grilled on decisions before big builds.
