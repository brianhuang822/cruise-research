# Research notes

Findings that shaped decisions, with sources. Dates are when they were checked.

## What cruisers weigh (2026-11-14)

- **Why people pick a cruise:** multiple destinations (22%) and value for money (15%) top the reasons over a land resort. Re-cruise intent is at a record high (~90%). Source: CLIA via [NerdWallet](https://www.nerdwallet.com/travel/learn/cruise-demand-record), [CLIA 2026 presentation](https://cruising.org/sites/default/files/2026-04/2026%20State%20of%20the%20Cruise%20Industry%20Presentation.pdf).
- **Travel advisors:** cost 78%, itinerary 78%, included amenities 73% ([TMR 2025](https://www.travelmarketreport.com/media/Outlooks/OceanCruiseOutlook2025.pdf)).
- **Experienced cruisers:** dining ~74%, entertainment 70%, cabin quality 57% ([Cruise118, Jan 2026](https://www.release.cruise118.com/blog/Expert-Bloggers/why-experiences-matter-more-than-destinations)).
- **Luxury buyers:** itinerary 39.8%, inclusions 39.6%, price 0.7% ([Cruiseline/Shipmate](https://www.prnewswire.com/news-releases/luxury-cruising-set-to-surge-according-to-new-cruiselinecom-and-shipmate-survey-302933972.html)).
- **J.D. Power 2013** factor order: service, stateroom, food, embark/debark, entertainment, cost, excursions. No newer edition was found.
- **Scholarly:**
  - Zhang, Ye, Song & Liu (2015), *Current Issues in Tourism* 18(5):450–464. 44,993 reviews; satisfaction and dissatisfaction are driven by different attributes (two-factor theory), and the split varies by ship tonnage. This is the basis for D26.
  - Hosany & Witham (2010), *Journal of Travel Research* 49(3):351–364. Satisfaction mediates the link between the experience and recommending it.
  - Crowding studies: cruise tourists tolerate spatial crowding less well than human crowding, and crowding lowers satisfaction. No peer-reviewed study validates GT ÷ passengers as a crowding measure; it's a heuristic.

## Price drivers (2026-11-14)

- Illustrative calculation: a $150 mainstream fare + $20 gratuities + $85 drinks + $20 Wi-Fi + one $60 specialty dinner over 7 nights = $283.57/pp/night, versus a $290 fully inclusive fare. Add-ons can nearly double a fare, which is why all-in pricing is the headline number.
- **Shareholder credit** (verified 2026-11-14): Carnival Corp $50 / $100 / $250 for ≤6 / 7–13 / 14+ days, valid for sailings through 2026-12-31 ([CCL](https://www.carnivalcorp.com/investors/shareholder-information/shareholder-benefit/)). RCG $50 / $100 / $250 for ≤5 / 6–13 / 14+ nights, $1,000 on world cruises ([RCL](https://rclinvestor.com/faqs/shareholder-benefit)). NCLH $50 / $100 / $250 for ≤6 / 7–14 / 15+ days ([NCLH](https://www.nclhltd.com/investors/shareholder-benefits)). No Viking (VIK) benefit was found.
- **Gratuities change often:**
  - Virgin unbundled gratuities on 2025-10-07 ($20 prepaid / $22 onboard).
  - Viking went from $17 to $20 on 2026-01-01.
  - Carnival goes to $17 / $19 on 2026-04-02.
  - Princess to $18 on 2026-03-08.
  - Holland America +$1 from 2026-06-01 (sources conflict).
  - Celebrity to $19.50 / $20.50 / $24.50 on 2026-07-29 ([Cruise Critic](https://www.cruisecritic.com/news/celebrity-cruises-gratuity-increase-sparks-debate-among-cruisers)).
- **Bundles:** HAL Have It All $60/pp/day before summer 2027, $65 after ([HAL](https://www.hollandamerica.com/en/us/cruise-deals/have-it-all)). Princess Plus $70 / Premier $105 from 2026-10-13. Celebrity All Included = Classic drinks + Basic Wi-Fi; the upcharge isn't published ([Celebrity FAQ](https://www.celebritycruises.com/faqs/all-included)).

## Data sources (2026-11-14)

- **CruisePlum:** Cloudflare bot challenge on every page; robots.txt disallows `/data/` and `/data-voyage/` (allows `hot_deals`, `last_minute_deals`, `price_drops`, `solo_supp` under `/data/US|CA/`). Terms couldn't be read. Conclusion: manual export by the owner only.
- **CDC Vessel Sanitation Program Green Sheet:** public domain; the HTML differs by user agent; scripted in `fetch_cdc.py`. Scores ≤85 are "not satisfactory". There is an outbreak list at [cdc.gov/vessel-sanitation/cruise-ship-outbreaks](https://www.cdc.gov/vessel-sanitation/cruise-ship-outbreaks/) (for D29).
- **Wikidata:** 640 active cruise-ship items; GT on 76%, capacity on 70%; operator tagging is weak; capacity values are mixed (double, maximum, crew). The query service was rate-limited (1 request/min) during an outage on 2026-11-14.
- **Wikipedia fleet tables** parse cleanly with `pandas.read_html` (e.g. Royal Caribbean: per-class tables with Year, GT, double and maximum berths). Useful for seeding `ships.csv`; cite the page.

## Suite and perk findings (2026-11-14)

- **Celebrity Retreat:** butler for all suites. Premium drinks + Wi-Fi for all Retreat. Laundry, unlimited specialty dining and thermal suite start at Royal Suite. Retreat Sundeck is missing on Solstice, Eclipse, Reflection, Constellation and Infinity ([Celebrity](https://www.celebritycruises.com/things-to-do-onboard/staterooms/suite-class)).
- **Royal Caribbean Royal Suite Class:** laundry is listed for Star Class only ([RCI FAQ](https://www.royalcaribbean.com/gbr/en/faq/questions/what-are-the-benefits-of-royal-suite-class)).
- **Princess:** Reserve Collection suites include laundry; mini-suites don't ([Princess](https://www.princess.com/staterooms/reserve-collection)).
- **Loyalty:** RCG status match across Royal Caribbean, Celebrity and Silversea since 2024-06-05; Celebrity expanded Captain's Club on 2026-06-11 (v2 topic, D31).
- **Celebrity has no self-service laundry** ([TPG](https://thepointsguy.com/cruise/cruise-ship-laundry)).

## M2 data findings (2026-11-14)

- **Official fleet sources:** Carnival Corporation publishes [Ships in our Fleet (2026-05-31)](https://www.carnivalcorp.com/wp-content/uploads/2026/06/Ships-in-our-Fleet-as-of-May-31-2026.pdf) with capacity for Carnival, Princess, HAL, Cunard and Seabourn. NCLH's [FY2024 10-K](https://nclhltd.com/investors/sec-filings/annual-reports/content/0001558370-25-001743/0001558370-25-001743.pdf) lists every NCL/Oceania/Regent ship with **primary operating regions**, an official interim source for region tags (D25) until the CruisePlum export arrives. It has no per-ship berths.
- **Fleet changes:** Seabourn Sojourn left in June 2026; Oceania Regatta left in 2026; Norwegian Sky left in 2026; Regent Navigator may leave in October 2026 (one source); Explora III entered service in July 2026 (not loaded: capacity unconfirmed); Viking Mira entered service in June 2026; Disney Adventure (Singapore) in March 2026.
- **Price and policy changes found:** MSC gratuities $17/$23 for bookings from 2026-05-11. Carnival moves drink and Wi-Fi packages to per-sailing pricing from 2026-12-01. NCL renamed More at Sea back to Free at Sea (drinks service charge $28.50/day). Princess Plus $70 / Premier $105 ($75/$110 on Sun and Star). Celebrity gratuities up $1.50 on 2026-07-29.
- **Wikipedia capacity caveats:** Disney's "capacity" column is maximum occupancy (capacity is derived from cabin count × 2 instead); Oceania's R-class figure is a class maximum (the official deck plan gives 684 double occupancy).
- **Wikipedia's REST API rate-limits** after a few requests; `pandas.read_html` on the REST HTML works well when it responds.

## Amenity pass (2026-11-14, D51)

- **Coverage before → after (of 207 ships):** water slides 24% → 63%, pickleball 17% → 46%, running track 37% → 58%, splash area 24% → 50%, covered pool 0 → 36%, promenade deck 0 → 13%, thermal suite 35% → 45%.
- **Best sources:** Royal Caribbean's per-ship "free things to do" guides; Carnival's help centre and `/onboard/*` pages (fleet lists for pickleball and jogging tracks); NCL ship-guide PDFs; Holland America's pools page and thermal-suite FAQ; Viking deck-plan PDFs; domain-restricted search of each official site. Cruise Critic blocks fetches; Carnival's help centre renders client-side (use search).
- **Corrections from official sources:** jogging tracks on Carnival Conquest and Vista class and NCL Breakaway class (were 0); none on Carnival Elation and Paradise (was 1); Conquest-class ships have the Twister slide (only Glory has the full WaterWorks park).
- **Thermal suites mostly cost extra:** 69 of 81 ships with a known suite charge for it. Included for everyone on Viking; included by cabin tier on Celebrity AquaClass/suites and Carnival Cloud 9 Spa cabins.
- **Still open:** promenade and covered-pool "no" values; Disney, Azamara, Silversea, Crystal, Ritz-Carlton and Virgin amenities; MSC older classes; Princess Grand/Coral covered pools and promenades.

### Second pass (2026-11-14)

- **Coverage now:** running track 77% (160 ships), sports court 54%, pickleball 53%, covered pool 44%, promenade deck 24%; slides, splash, adults-only pool and thermal unchanged from the first pass.
- **Official fleet lists found:** Celebrity's pickleball page (Apex, Ascent, Beyond, Xcel, Eclipse, Equinox and the four Millennium-class ships; "not available on Celebrity Edge, Reflection, Silhouette, Solstice"); MSC's sport pages (jogging track on all ships except World Europa; basketball court on all except Opera, Lirica and Preziosa); Carnival's help centre; planDisney answers for Disney's Deck 4 promenades.
- **Correction:** Celebrity Edge and Celebrity Solstice had pickleball recorded as yes; Celebrity's own list says no.
- **Why promenade stays low:** lines with walk-around decks advertise them (Holland America, Cunard, Princess Grand/Coral, Viking, Crystal, Disney Magic/Dream classes, NCL Prima's Ocean Boulevard), but mega-ship lines never state that they lack one, and D51 doesn't accept silence as "no". Confirmed-first ordering (D52) keeps the filter useful anyway.

## Line sweep (2026-11-15, D61)

- **Added:** Windstar (6 ships; Star Seeker pending capacity), Margaritaville at Sea (Paradise, Islander), Paul Gauguin (1), SeaDream (2), Four Seasons Yachts (Four Seasons I, sailing since 20 March 2026).
- **Weak spots in the new data:** Margaritaville capacities are the published figures and may be maximums, not double occupancy; Windstar inclusions beyond the $16/day hotel service charge and the All-In package are unconfirmed; SeaDream Wi-Fi terms unconfirmed; Four Seasons inclusions vary by source (breakfast, soft drinks and gratuities included; lunch, dinner and alcohol paid). Fare estimates for Windstar and SeaDream rest on trade and aggregator figures.
- **Deferred:** Celestyal (2 ships, Greece; capacity not found), Star Clippers (3 tall ships), Emerald yachts (Azzurra, Sakara), Orient Express Corinthian (service status not confirmed).
