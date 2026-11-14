# Cruise Cabin Finder

Static site that compares cruise **ship × cabin tier** combinations by all-in price per person per night, suite perks, ship size and amenities. Three modes share one engine: **Simple**, **Detailed** and **Help me choose** (a decision-tree quiz).

Spec, decisions and milestones: [`roadmap.md`](roadmap.md).

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

Quality gate: `ruff check scripts tests`, `ruff format --check scripts tests`, and `npx aislop@0.19.1 scan`.

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
