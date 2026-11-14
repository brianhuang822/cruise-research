# Cruise Cabin Finder — Spec & Roadmap

Status: **M0 – spec draft, awaiting sign-off** · Drafted 2026-11-14

A public static site that compares **ship × cabin tier** combinations by hard, quantifiable characteristics and an **all-in price per person per night**. Itinerary search is out of scope: once a user picks a ship + tier, they go to CruisePlum to watch sailings and prices.

---

## 1. Principles

1. **Quantify or drop it.** Every filter maps to a number, an enum, or a boolean with a written definition. No vibes.
2. **All-in price is the headline number.** Base fare alone misranks lines; add-ons can nearly double a mainstream fare (see §5.4).
3. **Unknown ≠ No.** Missing data is shown as unknown and the user decides whether unknowns pass filters.
4. **Every fact is sourced and dated.** Each data row carries `source_url` + `last_verified`. Inclusion policies change often (Virgin unbundled gratuities Oct 7 2025; Viking raised its daily charge $17→$20 on Jan 1 2026).
5. **Few options, high signal.** Features that don't vary across ships, or that users rarely filter on, are cut (see §3.3).

---

## 2. Decisions log (from the grill, 2026-11-14)

| # | Decision | Outcome |
|---|---|---|
| D1 | Audience | **Public** site |
| D2 | Unit of comparison | **Ship × cabin tier**; tier boundaries drawn where perks change (e.g. Celebrity Sky Suite vs Royal Suite) |
| D3 | Scope | ~20 ocean lines, mainstream → luxury; **no river, no expedition** |
| D4 | Price basis | **US market**, cruise fare only (taxes/port fees excluded), **median lowest fare per tier over next 12 months**, with as-of date |
| D5 | Shareholder input | **Ticker checkboxes only** (assumes ≥100 shares) → onboard credit applied as price adjustment, not a filter |
| D6 | Ranking | **Both**: hard filters + sortable columns **and** a user-weighted score |
| D7 | Unknowns | **Toggle** include/exclude unknowns in filters |
| D8 | Data refresh | **One-time** load, visible `last_updated` timestamp |
| D9 | Tech | Vanilla JS + JSON on GitHub Pages, filter state in URL, mobile-first |
| D10 | Suite gratuity rates | **Modeled per tier** |
| D11 | Itinerary | **Out.** Filter ship × cabin only; link out to CruisePlum for sailings |
| D12 | Fine dining | Expressed as an **"Included dining" dropdown** (buffet/MDR only → some specialty → all restaurants), not a boolean |
| D13 | Ship size | Gross tonnage kept as a **seasickness proxy** (bigger generally = less motion) |

---

## 3. Scope

### 3.1 Lines (19)

| Line | Segment | Parent | Shareholder ticker |
|---|---|---|---|
| Royal Caribbean | Mainstream | Royal Caribbean Group | RCL |
| Celebrity | Premium | Royal Caribbean Group | RCL |
| Silversea | Luxury | Royal Caribbean Group | RCL — *benefit coverage unconfirmed → unknown* |
| Carnival | Mainstream | Carnival Corp & plc | CCL / CUK |
| Princess | Premium | Carnival Corp & plc | CCL / CUK |
| Holland America | Premium | Carnival Corp & plc | CCL / CUK |
| Cunard | Premium | Carnival Corp & plc | CCL / CUK |
| Seabourn | Luxury | Carnival Corp & plc | CCL / CUK |
| Norwegian (NCL) | Mainstream | Norwegian Cruise Line Holdings | NCLH |
| Oceania | Upper premium | NCLH | NCLH |
| Regent Seven Seas | Luxury | NCLH | NCLH |
| MSC | Mainstream | MSC Group (private) | — |
| Disney | Mainstream | Walt Disney Co. | — (no cruise benefit found) |
| Virgin Voyages | Premium | Private | — |
| Viking (ocean) | Premium | Viking Holdings | — (VIK: no benefit found) |
| Azamara | Premium | Private | — |
| Explora Journeys | Luxury | MSC Group (private) | — |
| Ritz-Carlton Yacht Collection | Luxury | Private | — |
| Crystal | Luxury | A&K Travel Group (private) | — |

Ships: ocean ships in service as of the data snapshot. Expedition ships (e.g. Silversea expedition fleet, Seabourn Venture/Pursuit, Viking Octantis/Polaris) are excluded.

### 3.2 Features in scope (v1)

| Group | Feature | Level | Used as |
|---|---|---|---|
| Cost | Base fare $/pp/night | Ship×Tier | Price input |
| Cost | Gratuities $/pp/day (0 = included) | Tier | Price input + filter "gratuities included" |
| Cost | Drinks included: `none` / `soft` / `alcohol` | Tier | Price input |
| Cost | Wi-Fi included: `none` / `included` | Tier | Price input |
| Cost | Specialty dinners included per cruise (`0`, N, `unlimited`) | Tier | Price input |
| Cost | Shareholder onboard credit | Parent company | Price adjustment |
| Cost | Fare bundles (e.g. HAL Have It All) and what they cover | Line | Price optimizer (§5.3) |
| Dining | Included dining level (dropdown, §4.4) | Tier | Filter |
| Dining | Private suite restaurant | Tier | Filter |
| Dining | Specialty restaurants on board (count) | Ship | Display/sort/score |
| Ship | Gross tonnage | Ship | Filter (min) + score |
| Ship | Passenger capacity (double occupancy), space ratio (derived) | Ship | Display/sort/score |
| Ship | Year built, last major refit | Ship | Display/sort/score |
| Ship | CDC VSP latest score + date | Ship | Display/sort/score |
| Cabin | Typical cabin size (sq ft, interior incl. balcony noted separately) | Tier (ship override) | Display/sort/score |
| Cabin | Suite enclave: private lounge, private sundeck/pool | Tier | Filter |
| Cabin | Laundry perk: `none` / `pressing` / `limited` / `unlimited` | Tier | Filter |
| Cabin | Butler, concierge, priority boarding | Tier | Filter |
| Amenity | Pickleball, sports court, running track | Ship | Filter |
| Amenity | Self-service laundry: `none` / `paid` / `free` | Ship | Filter |
| Amenity | Thermal suite: `none` / `paid` / `included` (tier may include it) | Ship (+Tier) | Filter |
| Amenity | Adults-only pool/solarium, pool count | Ship | Filter / display |
| Amenity | Kids club, teen club | Ship | Filter |
| Vibe | Minimum guest age (18 = adults-only ship) | Line | Filter "adults-only" |

### 3.3 Cut from v1 (decided, with reason)

| Feature | Reason |
|---|---|
| Gym | Every ocean ship has one → filters nothing |
| Solo cabins / single supplement | User decision |
| Passenger-to-crew ratio | User decision |
| Fuel (LNG / shore power) | User decision |
| Main dining fixed vs open seating | User decision |
| Smoking policy, onboard currency, market | User decision |
| Accessible cabin counts | User decision |
| Itinerary data (regions, ports, sea days, tenders, private island) | User decision — CruisePlum handles sailings |
| Third-party ratings (Cruise Critic, Berlitz) | Copyright/licensing; user decision |

### 3.4 Backlog (v2+)

- Shore excursions included (`none` / credit / per port) — matters for Regent/Oceania all-in comparisons
- Taxes & port fees per sailing
- Formal nights per 7 nights (dress code)
- Cap shareholder credit at estimated eligible onboard spend (§5.2)
- Score presets ("Foodie", "Smooth seas", "Value")
- Side-by-side compare view (2–4 rows)
- Scheduled data refresh (GitHub Action) + stale-field report
- Solo occupancy pricing

---

## 4. Data model

### 4.1 Entities

```
Line 1──* Tier            (tier = line-defined cabin class with a fixed perk set)
Line 1──* ShipClass 1──* Ship
Ship ×  Tier → Row        (a Row exists if the ship sells that tier; defaults to all line tiers)
Row  1──* PriceObservation (from CruisePlum import, aggregated to median $/pp/night)
```

Amenities are stored at **ShipClass** level with **Ship** overrides (refits change ships within a class).

### 4.2 Files (`data/`, CSV, UTF-8, one header row)

**`lines.csv`**

| Column | Type | Notes |
|---|---|---|
| `line_id` | slug | e.g. `celebrity` |
| `name` | text | |
| `segment` | enum `mainstream`/`premium`/`luxury` | |
| `parent` | text | |
| `ticker` | enum `RCL`/`CCL`/`NCLH`/blank | blank = no shareholder benefit |
| `shareholder_benefit` | enum `yes`/`no`/`unknown` | Silversea = `unknown` until confirmed |
| `min_age` | int | 18 = adults-only ship; else 0 |
| `drink_pkg_pppd` | $ | Cheapest alcoholic package incl. service charge, per person per day |
| `soft_pkg_pppd` | $ | Soft-drink package, per person per day |
| `wifi_pppd` | $ | Cheapest streaming-capable plan, 1 device, per day |
| `specialty_meal_price` | $ | Typical per-person specialty dinner cost |
| `source_urls` | text | `;`-separated |
| `last_verified` | date | |

**`bundles.csv`** — optional fare add-ons (NCL More at Sea, Celebrity All Included, Princess Plus/Premier, HAL Have It All, Virgin VoyageFair tiers, …)

| Column | Type | Notes |
|---|---|---|
| `bundle_id`, `line_id`, `name` | | |
| `price_pppd` | $ | per person per day, incl. any service charge |
| `covers_drinks` | enum `none`/`soft`/`alcohol` | |
| `covers_wifi` | bool | |
| `covers_specialty_meals` | int / `unlimited` | per cruise |
| `covers_gratuities` | bool | |
| `applies_to_tiers` | text | `all` or `;`-separated tier_ids |
| `source_urls`, `last_verified` | | |

**`tiers.csv`**

| Column | Type | Notes |
|---|---|---|
| `tier_id` | slug | e.g. `celebrity-retreat-royal` |
| `line_id` | FK | |
| `name` | text | Line's own name, e.g. "The Retreat – Royal Suite & above" |
| `tier_type` | enum | `interior` / `oceanview` / `balcony` / `junior_suite` / `perk_class` / `suite` / `top_suite` — cross-line normalized |
| `rank` | int | Order within the line (1 = cheapest) |
| `gratuity_pppd` | $ | 0 if included |
| `drinks_included` | enum `none`/`soft`/`alcohol` | |
| `wifi_included` | bool | |
| `specialty_meals_included` | int / `unlimited` | per cruise |
| `included_dining` | enum `main_only` / `some_specialty` / `all` | §4.4 |
| `private_restaurant` | bool | |
| `private_lounge` | bool | |
| `private_sundeck_pool` | bool | |
| `laundry_perk` | enum `none`/`pressing`/`limited`/`unlimited` | |
| `butler` | bool | |
| `concierge` | bool | |
| `priority_boarding` | bool | |
| `thermal_suite_included` | bool | e.g. Celebrity AquaClass |
| `sqft_min`, `sqft_max` | int | Typical interior sq ft (ship overrides allowed) |
| `ships` | text | `all` or `;`-separated ship_ids (where the tier exists) |
| `source_urls`, `last_verified` | | |

**`ship_classes.csv`** and **`ships.csv`** — amenity columns live on the class; any non-blank ship value overrides.

| Column | Type | Level |
|---|---|---|
| `ship_id`, `line_id`, `name`, `class_id` | | Ship |
| `year_built`, `last_refit` | int | Ship |
| `gt` | int | Ship |
| `pax_double` | int | Ship |
| `cdc_score`, `cdc_date` | int, date | Ship (blank if no US-port inspection) |
| `specialty_restaurants` | int | Class/Ship |
| `pickleball`, `sports_court`, `running_track` | bool | Class/Ship |
| `self_laundry` | enum `none`/`paid`/`free` | Class/Ship |
| `thermal_suite` | enum `none`/`paid`/`included` | Class/Ship |
| `adults_only_pool` | bool | Class/Ship |
| `pools` | int | Class/Ship |
| `kids_club`, `teen_club` | bool | Class/Ship |
| `source_urls`, `last_verified` | | both |

**`prices.csv`** (generated by `scripts/import_prices.py` from the manual CruisePlum export, never hand-edited)

| Column | Notes |
|---|---|
| `ship_id`, `tier_id` | |
| `fare_pppn_median` | Median of lowest fare per sailing ÷ nights, per person, double occupancy |
| `n_sailings` | Sample size behind the median |
| `fare_basis` | `cruise_only` or a `bundle_id` if CruisePlum's price includes one |
| `as_of` | Export date |

### 4.3 Encoding rules

- Booleans: `1` / `0` / blank (= unknown). Enums: listed values or blank (= unknown). Never write `0` for "didn't check".
- `$` fields: USD, numeric, no symbols.
- Derived at build time, never stored by hand: `space_ratio = gt / pax_double`, `age_years`, all-in price components.

### 4.4 "Included dining" levels (dropdown)

| Value | Label | Definition |
|---|---|---|
| `main_only` | Main dining + buffet only | No specialty restaurant included in fare |
| `some_specialty` | Some specialty included | ≥1 specialty venue or meal included, others surcharged |
| `all` | All restaurants included | All venues included, at most one surcharged premium venue |

Filter semantics: "at least" (choosing `some_specialty` also shows `all`). A separate checkbox filters for a **private suite restaurant**.

---

## 5. Pricing model

### 5.1 User inputs (not filters)

| Input | Control | Default |
|---|---|---|
| Trip length (nights) | Select: 3–5 / 6 / 7 / 10 / 14+ | 7 |
| Shareholder of | Checkboxes: CCL/CUK, RCL, NCLH | none |
| Drinks | Select: none / soft drinks / alcohol package | none |
| Wi-Fi | Checkbox | off |
| Specialty dinners per cruise | Number 0–14 | 0 |

Occupancy is fixed at **2 guests per cabin** in v1.

### 5.2 Formula (per person per night)

```
fare            = prices.fare_pppn_median
gratuity        = tier.gratuity_pppd
drinks          = 0 if tier covers requested level else line.{soft|drink}_pkg_pppd
wifi            = 0 if !wantWifi or tier.wifi_included else line.wifi_pppd
specialty       = max(0, dinners - tier.included) * line.specialty_meal_price / nights
a_la_carte      = gratuity + drinks + wifi + specialty
extras          = min(a_la_carte, min over applicable bundles of (bundle.price_pppd + items the bundle doesn't cover))   (§5.3)
shareholder_obc = obc_tier(parent, nights) / 2 guests / nights      (0 if ticker unchecked or benefit != yes)
ALL_IN          = fare + extras − shareholder_obc
```

- The UI always shows the breakdown: fare · gratuities · add-ons · −OBC.
- If `fare` is unknown, the row shows **"add-ons: $X/night"** so users can still see the cost of inclusions, and the price filter treats the row as unknown.
- Shareholder credit tiers (per stateroom, USD; verified 2026-11-14):

| Parent | Short | Mid | Long | Notes |
|---|---|---|---|---|
| Carnival Corp (CCL/CUK) | ≤6 days $50 | 7–13 $100 | 14+ $250 | Valid for sailings **through Dec 31 2026**; reviewed annually. Not usable for casino or gratuities. Brands in scope: Carnival, Princess, HAL, Seabourn, Cunard |
| Royal Caribbean Group (RCL) | ≤5 nights $50 | 6–13 $100 | 14+ $250 | $1,000 world cruise. Bookings on/after Jun 1 2023. Not for service charges or pre-purchased items. RCI + Celebrity confirmed; Silversea unconfirmed |
| NCLH | ≤6 days $50 | 7–14 $100 | 15+ $250 | Not for service charges or pre-purchased items. NCL, Oceania, Regent |

- **Assumption (shown in tooltip):** the credit is fully used on eligible onboard spend. On RCL/NCLH it can't pay for pre-purchased packages, so it effectively offsets onboard purchases. v2 may cap it.

### 5.3 Bundle optimizer

For each row, compute à-la-carte add-on cost and the cost of each applicable bundle that satisfies the user's selections; take the minimum and label which one was chosen (e.g. "cheapest via Have It All"). This matters because bundles are often cheaper than buying the items separately, and Celebrity sells the "All Included" fare by default in the US.

### 5.4 Sanity example (illustrative inputs, not live prices)

7 nights, 2 guests: a $150 mainstream fare + $20 gratuities + $85 drinks + $20 Wi-Fi + one $60 specialty dinner = **$283.57/pp/night** (add-ons = 89% of fare), versus a $290 fully-inclusive fare. A $100 shareholder credit = **$7.14/pp/night** (≈5% of a $150 fare).

---

## 6. Filters, sorting, score

### 6.1 Filters (v1)

| Filter | Control | Semantics |
|---|---|---|
| Line / segment | Multi-select chips | OR within, AND across |
| Cabin type | Multi-select (`tier_type`) | OR |
| Max all-in $/pp/night | Slider | ≤ |
| Min ship size (GT) | Slider, with "bigger = less motion" hint | ≥ |
| Included dining | Dropdown (§4.4) | at least |
| Private suite restaurant | Checkbox | = 1 |
| Gratuities included | Checkbox | gratuity_pppd = 0 |
| Adults-only ship | Checkbox | min_age ≥ 18 |
| Cabin perks | Checkboxes: laundry (any / unlimited), butler, concierge, private lounge, private sundeck/pool, priority boarding | = 1 |
| Ship amenities | Checkboxes: pickleball, sports court, running track, self-service laundry, thermal suite, adults-only pool, kids club | = 1 / ≠ none |
| Unknowns | Toggle: include / exclude | Applies to every active filter |

### 6.2 Sorting

Any numeric column, ascending/descending: all-in price, GT, space ratio, year built, cabin sq ft, specialty restaurants, CDC score, score.

### 6.3 Weighted score

- User sets weights 0–5 on: **all-in price** (lower better), **GT**, **newness** (max of year built / last refit), **space ratio**, **cabin sq ft**, **specialty restaurants**, **CDC score**.
- Each metric is converted to a **percentile rank within the currently filtered rows** (0–100; price inverted), then `score = Σ(wᵢ·pᵢ) / Σwᵢ` over the metrics **known for that row**.
- The row shows "based on k of n metrics" and a hover breakdown. No hidden weights. Defaults: price 3, everything else 1.

---

## 7. UX spec

- **Layout:** filter drawer (left on desktop, bottom sheet on mobile) · input bar on top (trip length, shareholder, add-ons) · results as a table (≥900px) or cards (<900px).
- **Row content:** Ship · Line · Tier name · tier-type badge · **all-in $/pp/night** with expandable breakdown · GT · year · cabin sq ft · perk icons · score · "Find sailings on CruisePlum →".
- **URL state:** every input, filter, sort and weight is encoded in the query string, so links are shareable.
- **Footer:** `Data last updated <timestamp>`, sources page, CruisePlum attribution, disclaimer ("policies change; verify with the line before booking").
- **Accessibility:** keyboard-operable controls, labels on every input, WCAG AA contrast, light/dark themes.
- **Performance budget:** ≤1,500 rows, `data.json` ≤ 500 KB gzipped, filter response < 50 ms on a mid-range phone.

---

## 8. Architecture

```
roadmap.md
README.md
data/                 # source of truth (CSV)
  lines.csv  bundles.csv  tiers.csv  ship_classes.csv  ships.csv  prices.csv
  raw/                # CruisePlum manual exports — gitignored (licensing, §9.2)
scripts/
  build.py            # validate CSVs → derive fields → docs/data.json (+ last_updated)
  import_prices.py    # raw CruisePlum export → data/prices.csv (median per ship×tier)
docs/                 # GitHub Pages root (static)
  index.html  app.js  styles.css  data.json  sources.html
```

- No framework, no runtime dependencies; Python 3 standard library only for scripts.
- `build.py` fails on validation errors: unknown enum values, out-of-range numbers (GT 1,000–260,000; year 1985–2027; $ ≥ 0), broken foreign keys, missing `source_urls`/`last_verified`, or a tier with no `tier_type`.
- `build.py` prints a coverage report (% known per field per line), so gaps are visible before publishing.
- Hosting: GitHub Pages from `/docs` (enable in repo Settings → Pages).

---

## 9. Data sourcing

### 9.1 Source priority

1. Line's official pages: fare/inclusion FAQs, suite program pages, deck plans, ship fact sheets
2. Parent company investor-relations pages (shareholder benefits)
3. CDC Vessel Sanitation Program Green Sheet (public domain)
4. Wikipedia / Wikidata for ship specs (seed only; attribute CC BY-SA / CC0)
5. Reputable trade press (Cruise Critic news, Travel Market Report) for change dates
6. Forums and blogs: leads only, never the sole source

Measured on 2026-11-14: Wikidata has 640 active cruise-ship items, with GT on 76% and capacity on 70%, but operator tagging is weak (e.g. only 1 of Virgin's 4 ships and 2 of Oceania's 8 are complete). So Wikidata is a seed, and every ship gets checked against the line's fact sheet.

### 9.2 CruisePlum (prices)

- The user loads data manually. CruisePlum's `robots.txt` disallows `/data/` and the site sits behind a Cloudflare bot challenge, so **no automated scraping**.
- **Licensing:** a manual export isn't a licence to republish. The public site and public repo publish **only derived medians** per ship × tier, with attribution; raw exports stay in gitignored `data/raw/`. Their terms couldn't be read (Cloudflare blocked access) and need a manual check before launch.
- **Import format needed** (one row per sailing × cabin category):
  `line, ship, sail_date, nights, cabin_category, price_pp, currency, includes_taxes, fare_basis, export_date`
  `import_prices.py` maps `cabin_category` → `tier_id` via a mapping table (`data/category_map.csv`).

---

## 10. Milestones

| Milestone | Deliverable | Done when |
|---|---|---|
| **M0 Spec** | This document | User signs off on §11 open questions |
| **M1 Vertical slice** | Schema + `build.py` + full UI with **one line end-to-end (Celebrity)**: tiers incl. Retreat laundry, RCL shareholder credit, bundles, ships, amenities | Every filter, sort, score, URL-state round-trip and the unknown toggle work on desktop and on a 390px phone |
| **M2 Line policies + tiers** | `lines.csv`, `tiers.csv`, `bundles.csv` for all 19 lines | 100% of tiers have `tier_type`, gratuity, inclusions; coverage report ≥ 90% |
| **M3 Ships + amenities** | `ship_classes.csv`, `ships.csv`, CDC scores | All in-scope ships with GT/pax/year; amenity coverage ≥ 80% |
| **M4 Prices** | `import_prices.py` + first CruisePlum load | ≥ 70% of rows have a fare median; `as_of` shown |
| **M5 QA + launch** | 10% random audit against sources, link check, Lighthouse ≥ 90, Pages live | Audit error rate < 5%; site public |

---

## 11. Open questions (need answers before M1/M4)

1. **CruisePlum export:** what exactly can you export? Per sailing × cabin category? Price per person or per cabin? Taxes included? For Celebrity and NCL, does the price include their default bundle?
2. **CruisePlum deep link:** what URL pattern shows a ship's sailings (e.g. `/ship/<name>`)? Otherwise the link goes to the CruisePlum home page.
3. **Repo visibility:** is `cruise-research` public? This decides whether `data/raw/` gitignoring is enough.
4. **Drinks granularity:** is `none / soft / alcohol` enough, or do you need basic vs premium alcohol?
5. **Default trip length:** 7 nights OK?
6. **Carnival Corp benefit after 2026:** it's only confirmed for sailings through Dec 31 2026. Show it for 2027 as "expected, unconfirmed", or hide it?
7. **Site name / domain:** GitHub Pages default URL, or a custom domain?

---

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Inclusions and gratuities change (Virgin 2025, Viking 2026, Carnival Apr 2026, Princess Mar 2026, HAL Jun 2026) | Wrong all-in prices | Per-row `last_verified`; one-time snapshot clearly dated; v2 refresh job |
| Price basis ambiguity (bundled vs cruise-only fares) | Double-counting add-ons | `fare_basis` on every price row; optimizer subtracts covered items |
| GT is a crude seasickness proxy | Over-promising comfort | Label it "bigger generally = less motion"; motion also depends on route, length, cabin location (low/midship) |
| Space ratio is a heuristic, not a validated crowding measure | Misleading precision | Display-only with an explanatory tooltip |
| Shareholder credit restrictions | Overstated savings | Tooltip on assumptions; date-limited (CCL through 2026) |
| MSC gratuity varies by region | Wrong gratuity | Store the US/Caribbean rate; note it in the tier |
| Amenity data gaps | Filters hide good options | Unknown toggle; coverage report; class-level defaults |
| CruisePlum licensing | Takedown/legal | Medians only, attribution, raw kept private; check terms before launch |

---

## Appendix A — Seed facts collected 2026-11-14 (to verify at M2)

**Gratuities, $/person/day (US)** — two 2026 guides; conflicts flagged ⚠

| Line | Standard | Suite / perk class | Note |
|---|---|---|---|
| Royal Caribbean | 18.50 | 21.00 | |
| Carnival | 17.00 | 19.00 | From Apr 2 2026 |
| NCL | 20.00 | 25.00 (Haven & suites) | |
| MSC | 16.00 | 20.00 (Yacht Club) | Caribbean/US rate |
| Disney | 16.00 | 27.25 (Concierge) | |
| Virgin | 20 prepaid / 22 onboard | same | Unbundled Oct 7 2025 |
| Celebrity | 18.00 | 19 Concierge/AquaClass; 23 Retreat | |
| Princess | 18.00 | 19 mini-suite/Club; 20 suites | From Mar 8 2026; in Plus/Premier bundles |
| Holland America | 17 or 18 ⚠ | 19 or 20 ⚠ | One source: +$1 from Jun 1 2026 |
| Viking | 20.00 | 20.00 | Discretionary; from Jan 1 2026 |
| Oceania, Regent, Silversea, Seabourn, Explora | included | included | Spa excluded |
| Cunard, Azamara, Ritz-Carlton, Crystal | ⚠ TBD | | |

**Bundles** (blog-sourced unless noted; verify): HAL Have It All $60/pp/day before summer 2027, $65 after (official page); Princess Plus $70 / Premier $105 from Oct 13 2026 ($75/$110 on Sun/Star Princess); Celebrity All Included ~$90 Classic ⚠; NCL More at Sea ⚠ unclear.

**Suite laundry examples** (official): Celebrity Retreat — laundry & pressing from **Royal Suite and above** only; Royal Caribbean — laundry listed for **Star Class** (top tier) only; Princess — Reserve Collection **suites** include laundry, mini-suites don't. NCL Haven: "expedited laundry" (Cruise Critic) ⚠.

### Sources
- Carnival Corp shareholder benefit — https://www.carnivalcorp.com/investors/shareholder-information/shareholder-benefit/
- RCG shareholder FAQ — https://rclinvestor.com/faqs/shareholder-benefit
- NCLH shareholder benefits — https://www.nclhltd.com/investors/shareholder-benefits
- Gratuities 2026 — https://www.gocruisetravel.com/en/guides/cruise-gratuities-comparison-2026 · https://eatsleepcruise.com/cruise-gratuities-explained/
- Virgin VoyageFair Choices — https://www.cruisecritic.com/news/virgin-voyages-structures-fares-into-three-options-removes-gratuities
- Viking $20 notice — https://boards.cruisecritic.com/topic/3069051-gratuitiesdaily-service-charge-increasing/page/3/
- HAL Have It All — https://www.hollandamerica.com/en/us/cruise-deals/have-it-all
- Celebrity Retreat — https://www.celebritycruises.com/things-to-do-onboard/staterooms/suite-class
- Royal Suite Class — https://www.royalcaribbean.com/gbr/en/faq/questions/what-are-the-benefits-of-royal-suite-class
- Princess Reserve Collection — https://www.princess.com/staterooms/reserve-collection
- CDC VSP Green Sheet — https://wwwn.cdc.gov/inspectionquerytool/InspectionGreenSheetRpt.aspx
- What cruisers weigh (research summary): CLIA via NerdWallet https://www.nerdwallet.com/travel/learn/cruise-demand-record · TMR 2025 https://www.travelmarketreport.com/media/Outlooks/OceanCruiseOutlook2025.pdf · Zhang, Ye, Song & Liu (2015) *Current Issues in Tourism* 18(5):450–464 · Hosany & Witham (2010) *Journal of Travel Research* 49(3):351–364
