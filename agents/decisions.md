# Decision log

Every decision made with the owner, in the order it was made, with the reason. Each line carries a D-number that matches `roadmap.md` §2 where one exists. **Do not reverse a decision without asking the owner.** Add new ones at the bottom.

## 2026-11-14 · Product shape (first grill)

| # | Decision | Why / notes |
|---|---|---|
| D1 | **Public** site | Owner's goal. Raises the bar on licensing and data accuracy |
| D2 | **Unit of comparison = ship × cabin tier.** Tier boundaries are drawn where perks change (e.g. Celebrity Sky Suite vs Royal Suite are separate tiers) | Perks such as free laundry depend on the suite sub-tier, not the line. Owner's example: concierge class with free laundry |
| D3 | **~20 ocean lines, mainstream → luxury. No river, no expedition ships** | Keeps scope finite; owner agreed |
| D4 | **US market, cruise-only fare, median lowest fare per tier over the next 12 months**, with an as-of date | Comparable across lines; taxes and port fees are excluded for now |
| D5 | **Shareholder perk = ticker checkboxes only** (assumes ≥100 shares) and it **adjusts price, not filters** | The credit is about 5% of a $150 fare on a 7-night cruise; real money, but not a reason to hide ships |
| D6 | **Both** hard filters/sorting **and** a user-weighted score | Owner wanted judgement by quantifiable characteristics |
| D7 | **Unknowns: toggle to show or hide** rows with unknown data | Unknown ≠ No |
| D8 | **One-time data load** with a visible last-updated timestamp | (Later amended by D29 for CDC data) |
| D9 | **Vanilla JS + JSON on GitHub Pages**, filter state in the URL, mobile-first | No framework, no runtime dependencies |
| D10 | **Suite gratuity rates modeled per tier** | Lines charge suites more (e.g. Celebrity Retreat $24.50/day) |
| D11 | **No itinerary/sailing search.** Users go elsewhere for sailings | (Region tags later added back by D25) |
| D12 | **"Fine dining" = an "Included dining" dropdown**: main dining + buffet only / some specialty included / all restaurants included, plus a "private suite restaurant" flag | "Fine dining" isn't measurable as a yes/no; the owner wanted to see fares that include only the buffet vs ones that include more |
| D13 | **Gross tonnage kept as a seasickness proxy** | Owner's reason for ship size. UI says "bigger generally = less motion" and that route and a low midship cabin matter too |

**Cut from v1 at the owner's request:** solo cabins / single supplement, passenger-to-crew ratio, fuel type (LNG/shore power), fixed vs open main dining, smoking policy, onboard currency, accessible cabin counts, itinerary data (regions, ports, sea days, tenders, private islands; regions later restored by D25), third-party ratings (Cruise Critic, Berlitz). **Also dropped: "has a gym"**, because every ocean ship has one.

**Backlog (v2+), agreed:** shore excursions included, taxes and port fees, formal nights per 7 nights, capping shareholder credit at eligible onboard spend.

## 2026-11-14 · Spec sign-off

| # | Decision | Why / notes |
|---|---|---|
| — | **Write the full spec in `roadmap.md` before building** | Owner's instruction. Keep the roadmap current |
| D14 | **Repo private until launch**; it goes public together with GitHub Pages | Owner |
| D15 | **CruisePlum is optional.** Prices import through a source-agnostic `prices.csv`. Owner will export from CruisePlum manually later | Owner: "if it's easier not to use CruisePlum, don't". Then: "I can export CruisePlum later" |
| D16 | **"Find sailings" links to the line's official ship page** | No third-party dependency |
| D17 | **Drinks granularity: none / soft / alcohol** | Owner: enough |
| D18 | **Default trip length 7 nights** | Owner |
| D19 | **Carnival Corp shareholder credit after Dec 31 2026: shown as "expected, unconfirmed"** | The official page only confirms sailings through 2026-12-31 |
| D20 | **Default GitHub Pages URL** (no custom domain) | Owner |

## 2026-11-14 · Build approach

| # | Decision | Why / notes |
|---|---|---|
| — | **First milestone (M1) = Celebrity end-to-end** | Exercises every feature: Retreat laundry, RCL credit, bundles, suite sub-tiers |
| D21 | **Deterministic data pipeline**: scripted fetchers write dated snapshots (CDC sanitation scores; Wikidata as cross-check only); curated CSVs hold sourced facts; `build.py` produces byte-identical `dataset.json` + flat `dataset.csv`; `--check` mode | Owner asked that sourcing be deterministic, rerunnable and analyzable in Python. Line websites can't be scripted reliably, so facts are curated with sources |
| — | **Pricing engine written once in JS, mirrored in Python**, with a parity test | Site and analysis must agree |
| D22 | **Three modes on one engine: Simple (default), Detailed, Help me choose (wizard/decision-tree quiz)** | Owner. The UI label is "Help me choose" because it's plainer for visitors than "Wizard" |
| D23 | **Code quality gate: `aislop scan` + `ruff`** | Owner asked for scanaislop/aislop. aislop is pinned to 0.19.1, because 0.22.0 was published an hour before first use (supply-chain caution). It lints code, not prose |
| — | **Copy rules for site text** (see `conventions.md`) | Owner asked to "unslop" the text. No unslop skill exists on the account, so the copy was edited by hand to these rules |
| — | **Ranking weights reachable in every mode** | Owner couldn't find them; they were only in a collapsed Detailed panel. Now: Simple has "What matters most?" chips plus Fine-tune sliders, the wizard results have an adjust panel, and Detailed's panel opens by default |

## 2026-11-14 · Brainstorm grill

| # | Decision | Why / notes |
|---|---|---|
| D24 | **Public hobby site. No affiliate links or monetization. No analytics** | Keeps the ranking neutral and credible |
| D25 | **Add region and US home-port tags per ship** (reverses part of the itinerary cut), **derived from the owner's CruisePlum export** by script | Itinerary is the top decision factor in surveys. Hand-curated deployments go stale every season. Owner should include region and departure-port columns in the export |
| D26 | **Perk and amenity checkboxes become Must have / Nice to have** | Must = filter, nice = adds to score. Grounded in two-factor satisfaction research (Zhang et al. 2015) |
| D27 | **Families in scope** ("we want anyone to use this"): `max_guests` per tier → "sleeps N" filter | Added to the schema; data is collected during M2 |
| D28 | **Weight presets: Foodie, Smooth seas, Value, Spa & wellness, Active** | Owner: yes |
| D29 | **Monthly automated CDC refresh (scores + outbreak history) via GitHub Action**, plus a "may be stale" badge on rows not verified in 6 months | Public site; stale data erodes trust |
| D30 | **Order of work: data breadth first** (M2/M3, all 19 lines) → fares + regions (M4) → features (M5) → launch (M6) | A one-line site with no fares isn't useful |
| D31 | **Loyalty status perks stay in v2** | Owner skipped the question; default applied |
| — | **Accepted features for M5:** CDC outbreak history, shortlist + side-by-side compare, "what changed" feed from data history, methodology + coverage page, report-an-error link (GitHub issue) | Owner agreed to the order; these are the brainstorm items marked "Add" |
| — | **Skipped:** price-drop alerts (static site; CruisePlum does it), ship length/beam, medical-center level | Low signal or not possible on a static site |
| — | **Commit to `main` as work lands** | Owner's instruction. The session branch is kept in sync |
| — | **Record all decisions in `agents/` + `AGENTS.md`** | Owner: "so we don't forget" |

## 2026-11-14 · Pre-export work

| # | Decision | Why / notes |
|---|---|---|
| D32 | **No CI.** The quality gate (build `--check`, tests, ruff, aislop) runs locally before each commit | Owner: not monetized, and no Actions minutes left for this project. The workflow added in e3ee22b was removed |
| D33 | **No automated CruisePlum scraping**, including BeautifulSoup or browser-automation workarounds | CruisePlum serves a Cloudflare managed challenge (`cf-mitigated: challenge`) and disallows `/data/` in robots.txt. A plain HTTP client gets the challenge page; getting past it means circumventing an access control, and the site is public. Manual export, a permissioned feed, or a user-run copy helper are the options |

## Still open

- CruisePlum export format: whether it includes taxes/fees, sail dates, region, departure port (owner will export and report).
- Silversea shareholder-credit coverage under RCL: unconfirmed, kept `unknown`.
- Wikidata snapshot not yet captured (its query service was rate-limiting during an outage); rerun `scripts/fetch_wikidata.py`.
- Set the GitHub default branch to `main` (repo Settings → General) before enabling Pages.
