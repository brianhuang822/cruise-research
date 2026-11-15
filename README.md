# Your Kind of Cruise

Static site that compares cruise **ship × cabin tier** combinations by all-in price per person per night, suite perks, ship size and amenities. Three modes share one engine: **Simple**, **Detailed** and **Help me choose** (a decision-tree quiz).

Spec, decisions and milestones: [`roadmap.md`](roadmap.md).

**Live site:** https://brianhuang822.github.io/cruise-research/ — served by GitHub Pages straight from `docs/` on `main` (no build step or Actions, D60). Every push to `main` republishes it within a minute or two.

To (re)enable publishing: repo **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder `/docs` → Save**. `docs/.nojekyll` tells Pages to serve the files as they are.

## Layout

```
data/curated/      hand-curated facts (CSV), every row has source_urls + last_verified
data/snapshots/    scripted, dated fetches (CDC sanitation scores, Wikidata cross-check)
data/dataset.json  built dataset (committed); data/dataset.csv is the same data, flat, for analysis
scripts/           fetchers, validator/builder, Python mirror of the pricing engine
docs/              the static site (GitHub Pages root); docs/data.json is a build output
tests/             build determinism, schema checks, JS/Python pricing parity
```

## Commands

```bash
python3 scripts/fetch_cdc.py        # refresh CDC Vessel Sanitation Program scores
python3 scripts/fetch_wikidata.py   # refresh Wikidata cross-check (rate-limited; retries)
python3 scripts/build.py            # validate CSVs, write dataset.json / dataset.csv / docs/data.json
python3 scripts/build.py --check    # fail if committed outputs differ from a fresh build
python3 -m unittest discover -s tests
python3 -m http.server -d docs 8000 # preview at http://localhost:8000
```

## Loading a fare export

1. Save the raw export (CSV, one row per sailing x cabin category) in `data/raw/` (gitignored).
2. Dry run: `python3 scripts/import_prices.py data/raw/export.csv --as-of YYYY-MM-DD --dry-run`
   It reports unmatched ships and cabin categories it couldn't map to a tier.
3. Fix gaps by adding rules to `data/curated/category_map.csv` (case-insensitive regex, lowest priority number wins).
4. Run without `--dry-run` to write `data/curated/prices.csv` and `data/curated/ship_deployments.csv`, then `python3 scripts/build.py`.

Columns are matched by name: ship, sail/departure date, nights, cabin category and price are required; cruise line, region/destination and
departure port are optional. Use `--per-cabin` if prices are for two guests, and `--fare-basis <bundle_id>` if the prices include a bundle.

Quality gate: `ruff check scripts tests`, `ruff format --check scripts tests`, and `npx aislop@0.19.1 scan`. Run them locally before each commit (no CI by design, D32).

## Analysing the data in Python

```python
import json, sys
sys.path.insert(0, "scripts")
import pricing

ds = json.load(open("data/dataset.json"))
lines = {l["line_id"]: l for l in ds["lines"]}
inputs = {"nights": 7, "tickers": ["RCL"], "drinks": "alcohol", "wifi": True, "dinners": 1}
for row in ds["rows"][:5]:
    print(row["row_id"], pricing.all_in(row, lines[row["line_id"]], ds["bundles"], ds["shareholder_benefits"], inputs))
```

## Publishing

Repository Settings → Pages → Deploy from branch → `/docs`. Make the repository public first.
