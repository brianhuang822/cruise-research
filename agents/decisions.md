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

## 2026-11-14 · Second brainstorm

| # | Decision | Why / notes |
|---|---|---|
| D34 | **Shore excursions are not modeled** (no field, no pricing); removed from the v2 backlog | Owner: people pick excursions to fit their own budget |
| D35 | **Attractions: only common, free-to-use ones**: water slides, mini golf, kids' splash area (alongside pickleball, sports court, running track). No paid attractions (go-karts, coasters, escape rooms) and no casino | Owner: "just free ones is enough" |
| D36 | **Accessibility and solo travel stay cut**, reconfirmed despite D27 | Owner decision after pushback |
| D37 | **No CI and no automated CDC refresh, even after the repo goes public.** CDC data is refreshed by running `scripts/fetch_cdc.py` with each data update. Supersedes the automation half of D29; the stale badge stays | Owner |
| D38 | **Work order before the export:** M3 cabin sizes + `max_guests` → D35 attractions → fare-independent M5 features (must/nice, presets, CDC outbreak history, stale badge, methodology page, report-an-error link) → shortlist/compare. Fares and regions load when the export arrives | Owner accepted defaults |

## 2026-11-14 · Quiz first

| # | Decision | Why / notes |
|---|---|---|
| D39 | **"Help me choose" is the landing mode and first tab** (order: Help me choose, Simple, Detailed). Supersedes the "Simple (default)" part of D22 | Owner |
| D40 | **Quiz results re-rank live**: priority chips, a sort menu and fine-tune weights on the results; the quiz also asks "What matters most?" (up to three) | Owner: "a way to sort based on change of weighted preferences" |
| D41 | **Food question is about where you eat without paying extra**: buffet + main dining room / plus a few paid specialty dinners / some specialty included / all included | Owner: frame it as buffet vs main dining room |
| D42 | **Wi-Fi question asks whether it must be free**; new **"Wi-Fi included"** filter in all modes (tier `wifi_included`; bundles don't count as free) | Owner |
| D43 | **Less on screen in Simple and Help me choose.** Simple shows cabin type, guests and three toggles (adults only, tips included, free Wi-Fi); trip length, dining, shareholder, drinks, less motion and weights sit under "More options". The budget menu appears only once fares exist, with the quiz's steps ($200/$400/$800). Cards: short tier name, one facts line, at most 3 perks. Quiz: progress bar without "Question X of N", short help text, top 5 with "Show 5 more", answers and weights folded. Header is title, tabs and Copy link; the data date moved to the footer. Detailed is unchanged | Owner: "UI feels crowded … Simple should be simpler" |
| D44 | **Site name: "Your Kind of Cruise"** (was "Cruise Cabin Finder"). Checked for clashes on 2026-11-14; rejected names already in use: Cruise Compass (Royal Caribbean's daily planner), Cruise Matchmaker (World of Cruising), Cruise Match (GetCruiseInfo quiz), SailMatch (Tern), Cabinmate Match (Carnival/ShipRocked roommate program), CabinFit (airline carry-on app) | Owner: the name should lean into finding people's preferences |
| D45 | **Simple is filters plus sort, nothing more.** No weight sliders in Simple (the priority chips under "More options" still set the ranking; sliders stay in the quiz's "Adjust weights" and in Detailed). Menus name themselves ("4 guests", "Any dining", "No cruise shares") with no visible labels; toggles are drawn as chips with the checkbox hidden | Owner: "Simple could be simpler still" |
| D46 | **Presets replace the priority chips in Simple** and sit above the sliders in Detailed (the quiz keeps its chips, D40). Shipped: **Value** (price 5, cabin size 2, CDC 1), **Foodie** (restaurants 5, CDC 2, price 2), **Smooth seas** (ship size 5, price 2, space 1); every other weight 0. Tapping the active preset again restores the default weights; the active preset is read from the weights, so links keep it. Value is hidden until fares exist. **Spa & wellness and Active are deferred** until amenity coverage reaches about 80% of ships: on 2026-11-14 thermal spa was known for 35% of ships, running track 37%, sports court 42%, pickleball 17%, so those rankings would reward ships we happened to research. Supersedes the Simple chips in D45 | Owner agreed to the recommendation; deferral is from the coverage check |
| D47 | **Cards use one label for basic cabin types** (Inside, Ocean view, Balcony) instead of each line's spelling (Oceanview, Ocean-View, Verandah, Sea Terrace). Suite and perk-class tiers keep the line's name (The Haven, Concierge Class), capped at two lines. The detail panel shows the line's own name | Owner agreed to the recommendation |
| D48 | **One card per ship in Simple and Help me choose.** The card shows the ship's best-matching cabin and "+N more cabins on this ship"; opening it lists those cabins in the current order, each with its own breakdown. Ties (common when ranking on ship-level measures) go to the cheaper cabin: all-in price, else the line's tier order. Counts read "N ships · M cabins"; paging and the quiz's top 5 count ships. Detailed keeps one row per cabin. Source links fold under "Sources (N)" | Owner: go-ahead after presets filled the top of the list with one ship's cabins |
| D49 | **Food question has three answers**: buffet + main dining room / plus a couple of paid specialty dinners / specialty restaurants included. "Some specialty included" was dropped from the quiz and Simple because no tier in the data is `some_specialty`, so it returned the same rows as "all" (Detailed keeps both levels). Help text names lines: every line, Carnival included, serves a buffet and a waiter-served main dining room at no charge (Carnival help centre and dining-room page); Oceania, Viking, Virgin and luxury lines include specialty restaurants. Amends D41 | Owner said the question still felt wrong; checked against carnival.com and the curated tiers |
| D50 | **Quiz asks "What kind of cruise line?" instead of the food question** (pick any): Mainstream / Premium / Premium, every restaurant included / Luxury, nearly everything included, each with example lines. Groups come from the data: the curated segment, except a non-luxury line whose cheapest cabin already includes specialty restaurants (today Oceania, Viking, Virgin) is its own type. Answers set the line filter (union of the picked types). The "couple of paid specialty dinners" pricing input is dropped from the quiz (still in Detailed). Replaces D41 and D49's quiz question; Simple's dining menu from D49 stays | Owner: "mainstream vs premium vs included specialty vs luxury" after learning every line includes the main dining room |

## Still open

- CruisePlum export format: whether it includes taxes/fees, sail dates, region, departure port (owner will export and report).
- Silversea shareholder-credit coverage under RCL: unconfirmed, kept `unknown`.
- Wikidata snapshot not yet captured (its query service was rate-limiting during an outage); rerun `scripts/fetch_wikidata.py`.
- Set the GitHub default branch to `main` (repo Settings → General) before enabling Pages.
