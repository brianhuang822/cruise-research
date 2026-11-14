# Conventions

## Data

- **Source of truth:** `data/curated/*.csv`. Column types and rules are in `scripts/schema.py`; `build.py` rejects anything that doesn't fit.
- **Unknown ≠ No.** Booleans are `1` / `0` / blank. Enums are a listed value or blank. Blank always means unknown.
- **Every fact row has `source_urls` (`;`-separated) and `last_verified` (YYYY-MM-DD).** Put conflicts and judgement calls in `notes`.
- **Source priority:** 1) the line's official pages; 2) parent-company investor-relations pages; 3) CDC Vessel Sanitation Program; 4) Wikipedia/Wikidata (specs only); 5) trade press (Cruise Critic news, Travel Market Report) for change dates; 6) blogs and forums as leads only, never the sole source for a perk.
- **Where data lives:** line-wide policy in `lines.csv`; perks and inclusions per cabin tier in `tiers.csv`; ship-specific exceptions to a tier in `tier_overrides.csv` (e.g. no Retreat Sundeck on Celebrity Solstice); amenities on `ship_classes.csv`, with a non-blank value in `ships.csv` overriding the class.
- **Tier boundaries:** split a line's cabins into tiers wherever perks change, not by marketing names. Name the tier with the line's own words.
- **Definitions used so far:**
  - `specialty_restaurants` = sit-down restaurants beyond the main dining room and buffet that are open to all guests, whether included or extra-charge, excluding bars, cafés, ice-cream/snack counters, dinner-theater shows and suite/class-only venues.
  - `sqft_min`/`sqft_max` = interior cabin area; balconies are mentioned in `notes`.
  - `max_guests` = the most guests any cabin in the tier can sleep.
  - Shareholder credit tiers stated in "days" are treated as nights.
  - `gratuity_pppd` = 0 only when the fare includes gratuities.
- **Wikidata** is a cross-check only. It mixes double occupancy, maximum occupancy and crew counts under one property.
- **Prices** enter only through `prices.csv` (generated, with `source`, `fare_basis`, `as_of`). Raw exports go in gitignored `data/raw/`. Publish only medians.
- **Snapshots** (`data/snapshots/*.json`) are written only by `scripts/fetch_*.py`. Review the diff before committing a refresh.

## Code

- Python 3.11+ standard library only for scripts (pandas is fine in throwaway analysis, not in the pipeline).
- `docs/pricing.js` is the pricing engine; `scripts/pricing.py` must stay in step (parity test).
- Front-end markup goes through the auto-escaping `html` template in `docs/js/dom.js`; `mount`/`append` are the only DOM sinks. No direct `innerHTML`.
- All modes share `docs/js/state.js` (state + URL) and `docs/js/engine.js` (filter, score, sort). A mode only renders.
- Keep files under ~400 lines and functions under ~80 (aislop limits).
- Pin third-party tool versions to releases at least two weeks old.
- Install downloaded tools into the scratchpad with `--ignore-scripts`; read before running.

## Copy (site text)

- Name things the way visitors would. Use active voice and short, plain sentences.
- No em-dash asides, "not X but Y" framing, colon-then-reveal sentences, scare quotes, or stock filler phrases.
- Errors say what went wrong and what to do next.
- Units are explicit: "$/pp/night", "GT", "sq ft".

## Git

- Commit to **`main`** as work lands, and keep `claude/cruise-ship-filter-site-2otsb9` in sync.
- Before committing: `python3 scripts/build.py --check`, `python3 -m unittest discover -s tests`, `ruff check scripts tests`, `ruff format --check scripts tests`, `aislop scan` (0.19.1).
- Commit messages end with the session attribution trailer supplied by the environment.
- Never commit `data/raw/`, caches or `node_modules/`.
