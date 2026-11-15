// Rendering pieces shared by all modes. Everything goes through html``, which escapes values.
import { AXES } from '../axes.js';
import { html } from '../dom.js';
import { METRICS, TIER_TYPES } from '../state.js';

export const fmt$ = (v) => (v == null ? '—' : '$' + Math.round(v).toLocaleString('en-US'));
export const fmt$2 = (v) => (v == null ? '—' : '$' + v.toFixed(2));
export const fmtN = (v) => (v == null ? '—' : Number(v).toLocaleString('en-US'));
export const typeLabel = (t) => (TIER_TYPES.find(([k]) => k === t) || [t, t])[1];
const unknown = (text = 'unknown') => html`<span class="unk">${text}</span>`;
const yn = (v) => (v == null ? unknown() : v ? 'Yes' : 'No');
const enumText = (v) => (v == null ? unknown() : String(v).replace(/_/g, ' '));

export function perkChips(row, ship) {
  const chips = [
    [row.gratuity_pppd === 0, 'Tips incl.'],
    [row.drinks_included === 'alcohol', 'Drinks incl.'],
    [row.drinks_included === 'soft', 'Soft drinks incl.'],
    [row.wifi_included, 'Wi-Fi incl.'],
    [row.included_dining === 'all', 'All dining incl.'],
    [row.included_dining === 'some_specialty', 'Some specialty incl.'],
    [row.private_restaurant, 'Private restaurant'],
    [row.laundry_perk === 'unlimited', 'Laundry unlimited'],
    [row.laundry_perk === 'limited' || row.laundry_perk === 'pressing', `Laundry ${row.laundry_perk}`],
    [row.butler, 'Butler'],
    [row.private_lounge, 'Lounge'],
    [row.private_sundeck_pool, 'Sundeck'],
    [row.thermal_suite_included, 'Thermal suite'],
    [ship.pickleball, 'Pickleball'],
    [ship.water_slides, 'Water slides'],
  ];
  return chips.filter(([on]) => on === true).map(([, label]) => label);
}

export const QUICK_SORTS = [['score', 'Best match'], ['price', 'Lowest price'], ['gt', 'Biggest ship'], ['newness', 'Newest ship'], ['sqft', 'Biggest cabin']];
// One-tap weight presets (D28, D46). A preset sets every weight; the active one is read back from the weights,
// so links and the sliders stay the source of truth. "Spa & wellness" and "Active" wait on amenity coverage (M3).
const BASE_METRICS = METRICS.filter(([k]) => k !== 'nice');
const DEFAULT_W = Object.fromEntries(BASE_METRICS.map(([k, , d]) => [k, d]));
export const PRESETS = [
  ['value', 'Value', { price: 5, gt: 0, newness: 0, space: 0, sqft: 2, dining: 0, cdc: 1 }],
  ['foodie', 'Foodie', { price: 2, gt: 0, newness: 0, space: 0, sqft: 0, dining: 5, cdc: 2 }],
  ['smooth', 'Smooth seas', { price: 2, gt: 5, newness: 0, space: 1, sqft: 0, dining: 0, cdc: 0 }],
];
const presetWeights = (k) => PRESETS.find(([id]) => id === k)[2];
export const activePreset = (w) => PRESETS.find(([, , pw]) => BASE_METRICS.every(([k]) => w[k] === pw[k]))?.[0] ?? null;
// Tapping the active preset again goes back to the default weights. Presets leave the nice-to-have weight alone.
export const applyPreset = (w, k) => ({ ...w, ...(activePreset(w) === k ? DEFAULT_W : presetWeights(k)) });

// "Value" ranks mostly on price, so it is hidden until fares are loaded.
export function presetChips(w, priced) {
  const on = activePreset(w);
  return html`<span class="rank-label">Rank for</span>
    ${PRESETS.filter(([k]) => priced || k !== 'value').map(([k, l]) => html`<button type="button" class="chip" data-preset="${k}" aria-pressed="${String(on === k)}">${l}</button>`)}`;
}

export function sortSelect(id, current) {
  const options = QUICK_SORTS.some(([v]) => v === current) ? QUICK_SORTS : [...QUICK_SORTS, [current, 'Custom (from Detailed)']];
  return html`<label class="sortbox" for="${id}">Sort
    <select id="${id}">${options.map(([v, l]) => html`<option value="${v}" ${current === v ? html`selected` : ''}>${l}</option>`)}</select></label>`;
}

// Weight sliders, shared by every mode. app.js commits a change on release (the 'change' event).
// The nice-to-have slider only appears once something is marked Nice.
export function weightSliders(w, prefix, showNice = false) {
  return html`<div class="weights-grid">${METRICS.filter(([k]) => showNice || k !== 'nice').map(([k, label]) => html`<label for="${prefix}-w-${k}"><span>${label}</span>
    <output id="${prefix}-wo-${k}">${w[k]}</output>
    <input type="range" id="${prefix}-w-${k}" data-weight="${k}" min="0" max="5" step="1" value="${w[k]}"></label>`)}</div>`;
}

const SHORT = { price: 'price', gt: 'ship size', newness: 'newness', space: 'space per guest', sqft: 'cabin size', dining: 'restaurants', cdc: 'cleanliness', nice: 'nice-to-haves' };
export function rankSummary(w, hasNice = false) {
  const on = METRICS.filter(([k]) => w[k] > 0 && (k !== 'nice' || hasNice)).sort((a, b) => w[b[0]] - w[a[0]]);
  return on.length ? `Ranked by ${on.map(([k]) => `${SHORT[k]} ×${w[k]}`).join(', ')}` : 'No ranking weights set; results are in default order';
}

export const chipList = (labels) => html`<div class="perks">${labels.map((p) => html`<span class="perk">${p}</span>`)}</div>`;

export function priceCell(p) {
  if (p.all_in != null) {
    const how = `${p.estimated ? 'estimate · ' : ''}${p.method !== 'a_la_carte' ? 'via bundle' : 'fare + extras'}${p.obc ? ' − credit' : ''}`;
    return html`<span class="price">${p.estimated ? html`<abbr class="est" title="Estimated typical fare for this line and cabin type, plus your extras">~</abbr>` : ''}${fmt$(p.all_in)}</span><small>${how}</small>`;
  }
  if (p.extras != null) return html`<span class="pending">Fare pending</span><small>${p.extras ? `+${fmt$(p.extras)}/night extras` : 'No extras to add'}</small>`;
  const names = [...new Set(p.missing.filter((m) => m !== 'fare').map((m) => MISSING_LABELS[m] ?? m.replace(/_/g, ' ')))];
  const gaps = names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : (names[0] ?? '');
  const head = p.missing.includes('fare') ? 'Fare pending' : 'Price unknown';
  return html`<span class="pending unk">${head}</span>${gaps ? html`<small>${gaps[0].toUpperCase() + gaps.slice(1)} cost unknown</small>` : ''}`;
}

// Plain names for the pricing inputs priceCell can report as missing.
const MISSING_LABELS = {
  gratuity: 'tips', drinks_included: 'drinks', drink_pkg_pppd: 'drinks', soft_pkg_pppd: 'drinks',
  wifi_included: 'Wi-Fi', wifi_pppd: 'Wi-Fi', specialty_meals_included: 'dinners', specialty_meal_price: 'dinners',
};

const PART_LABELS = { gratuity: 'Gratuities', drinks: 'Drinks', wifi: 'Wi-Fi', specialty: 'Specialty dinners', bundle: 'Bundle' };

function priceBlock(it, data) {
  const { row, priced: p } = it;
  const bundle = data.bundles.find((b) => b.bundle_id === p.method);
  const parts = Object.entries(p.parts).filter(([, v]) => v > 0);
  return html`<div>
    <h3>Price per person per night</h3>
    <dl>
      <dt>${p.estimated ? 'Estimated fare' : 'Median fare'}</dt><dd>${p.fare == null ? unknown('pending') : fmt$2(p.fare)}</dd>
      ${parts.map(([k, v]) => html`<dt>${PART_LABELS[k] || k}</dt><dd>${fmt$2(v)}</dd>`)}
      <dt>Extras subtotal</dt><dd>${p.extras == null ? unknown() : fmt$2(p.extras)}</dd>
      ${p.obc ? html`<dt>Shareholder credit</dt><dd>−${fmt$2(p.obc)}</dd>` : ''}
      <span class="sep"></span>
      <dt>All-in</dt><dd class="total">${p.all_in == null ? '—' : fmt$2(p.all_in)}</dd>
    </dl>
    ${bundle ? html`<p class="hint">Cheapest option for your extras is ${bundle.name}.</p>` : ''}
    ${p.obc_note ? html`<p class="hint">${p.obc_note}</p>` : ''}
    ${p.obc_status === 'unknown' ? html`<p class="hint">We couldn't confirm the shareholder credit for this line.</p>` : ''}
    ${row.fare_as_of ? html`<p class="hint">Fare: median of ${row.fare_n_sailings} sailings, ${row.fare_source}, as of ${row.fare_as_of}.</p>` : ''}
    ${p.estimated ? estimateNote(row, data) : ''}
  </div>`;
}

// Where an estimated fare came from (D57). Estimates are per line and cabin type, not per ship or sailing.
function estimateNote(row, data) {
  const e = data.fare_estimates?.lines.find((x) => x.line_id === row.line_id);
  if (!e) return '';
  const urls = e.sources.map((id) => data.sources[id]).filter(Boolean);
  return html`<p class="hint">Estimated fare: a typical price for this line and cabin type, not this ship or a specific sailing.
    Based on: ${e.samples}. ${e.notes || ''}
    ${urls.map((u, i) => html`<a href="${u}" target="_blank" rel="noopener">source ${i + 1}</a> `)}</p>`;
}

// Fares on the site: real medians, estimates, or none yet.
export const fareState = (data) =>
  data.rows.some((r) => r.fare_pppn_median != null) ? 'real' : data.rows.some((r) => r.fare_est_pppn != null) ? 'estimate' : 'none';

function tierBlock(row) {
  const meals = row.specialty_meals_included === 'unlimited' ? 'Unlimited' : row.specialty_meals_included;
  const grat = row.gratuity_pppd == null ? unknown() : row.gratuity_pppd === 0 ? 'Included' : `${fmt$2(row.gratuity_pppd)}/day`;
  return html`<div>
    <h3>Included with this tier</h3>
    <dl>
      <dt>Line's name</dt><dd>${row.name}</dd>
      <dt>Gratuities</dt><dd>${grat}</dd>
      <dt>Drinks</dt><dd>${enumText(row.drinks_included)}</dd>
      <dt>Wi-Fi</dt><dd>${yn(row.wifi_included)}</dd>
      <dt>Specialty dinners</dt><dd>${meals == null ? unknown() : meals}</dd>
      <dt>Dining level</dt><dd>${enumText(row.included_dining)}</dd>
      <dt>Private restaurant</dt><dd>${yn(row.private_restaurant)}</dd>
      <dt>Laundry</dt><dd>${enumText(row.laundry_perk)}</dd>
      <dt>Butler · concierge</dt><dd>${yn(row.butler)} · ${yn(row.concierge)}</dd>
      <dt>Lounge · sundeck</dt><dd>${yn(row.private_lounge)} · ${yn(row.private_sundeck_pool)}</dd>
      <dt>Priority boarding</dt><dd>${yn(row.priority_boarding)}</dd>
      <dt>Thermal suite</dt><dd>${yn(row.thermal_suite_included)}</dd>
      <dt>Sleeps up to</dt><dd>${row.max_guests ?? unknown()}</dd>
    </dl>
  </div>`;
}

function shipBlock(ship, line) {
  const cdc = ship.cdc_score == null ? unknown('not inspected') : `${ship.cdc_score} (${ship.cdc_date})`;
  return html`<div>
    <h3>Ship · ${ship.class_name || ''}</h3>
    <dl>
      <dt>Gross tonnage</dt><dd>${fmtN(ship.gt)}</dd>
      <dt>Guests (double occ.)</dt><dd>${fmtN(ship.pax_double)}</dd>
      <dt>Space ratio</dt><dd>${ship.space_ratio}</dd>
      <dt>Built · last refit</dt><dd>${ship.year_built} · ${ship.last_refit ?? '—'}</dd>
      <dt>Specialty restaurants</dt><dd>${ship.specialty_restaurants ?? unknown()}</dd>
      <dt>CDC score</dt><dd>${cdc}</dd>
      <dt>Pickleball · court</dt><dd>${yn(ship.pickleball)} · ${yn(ship.sports_court)}</dd>
      <dt>Running track</dt><dd>${yn(ship.running_track)}</dd>
      <dt>Self-service laundry</dt><dd>${enumText(ship.self_laundry)}</dd>
      <dt>Thermal suite</dt><dd>${enumText(ship.thermal_suite)}</dd>
      <dt>Adults-only pool · pools</dt><dd>${yn(ship.adults_only_pool)} · ${ship.pools ?? '—'}</dd>
      <dt>Kids · teen club</dt><dd>${yn(ship.kids_club)} · ${yn(ship.teen_club)}</dd>
      <dt>Water slides · splash area</dt><dd>${yn(ship.water_slides)} · ${yn(ship.splash_area)}</dd>
      <dt>Mini golf</dt><dd>${yn(ship.mini_golf)}</dd>
      <dt>Promenade deck · covered pool</dt><dd>${yn(ship.promenade_deck)} · ${yn(ship.covered_pool)}</dd>
      <dt>Sails ${ship.deployment_basis === 'curated' ? '(approx.)' : ''}</dt><dd>${ship.regions ? ship.regions.join(', ') : unknown()}</dd>
      ${ship.homeports ? html`<dt>US home ports</dt><dd>${ship.homeports.join(', ')}</dd>` : ''}
    </dl>
    <p class="sailings"><a href="${ship.official_url}" target="_blank" rel="noopener">See sailings on ${line.name} →</a>
      <a href="https://www.cruiseplum.com/search" target="_blank" rel="noopener">Compare sailing prices on CruisePlum →</a></p>
  </div>`;
}

// With a compass set (D59), the breakdown compares the visitor with this cabin on each axis they set.
function compassBreakdown(it, compass) {
  const set = AXES.filter(([k]) => compass[k] != null);
  return html`<h3>Compass fit ${it.fit ?? '—'} (${it.used} of ${it.of} axes)</h3>
    <dl>${set.map(([k, left, right]) => html`<dt>${left} ↔ ${right}</dt><dd>you ${compass[k]} · this ${it.ax[k] ?? unknown('no data')}</dd>`)}</dl>`;
}

function aboutBlock(it, engine, state) {
  const { row, ship, line } = it;
  const tier = engine.TIERS[row.tier_id];
  const weights = state.w;
  const scored = Object.keys(state.compass).length ? [] : METRICS.filter(([k]) => weights[k] > 0);
  const urls = [...new Set([...row.sources, ...ship.sources, ...line.sources])].map((id) => engine.data.sources[id]).filter(Boolean).sort();
  return html`<div>
    ${Object.keys(state.compass).length ? compassBreakdown(it, state.compass) : ''}
    ${scored.length ? html`<h3>Score breakdown (${it.used} of ${it.of} measures)</h3>
      <dl>${scored.map(([k, label]) => html`<dt>${label}</dt><dd>${it.parts[k] == null ? unknown('no data') : `${Math.round(it.parts[k])}th pct`}</dd>`)}</dl>` : ''}
    ${tier?.notes ? html`<h3 class="gap">Notes</h3><p>${tier.notes}</p>` : ''}
    ${row.overridden.length ? html`<p class="hint">Different on this ship: ${row.overridden.join(', ').replace(/_/g, ' ')}.</p>` : ''}
    <details class="sources-fold"><summary>Sources (${urls.length}) · checked ${row.last_verified}</summary>
      <ul class="sources">${urls.map((u) => html`<li><a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 80)}</a></li>`)}</ul>
    </details>
  </div>`;
}

// withShip is false for the extra cabins listed inside a ship's card, which already shows the ship once.
export function detailHtml(it, engine, state, withShip = true) {
  return html`<div class="detail">${priceBlock(it, engine.data)}${tierBlock(it.row)}${withShip ? shipBlock(it.ship, it.line) : ''}${aboutBlock(it, engine, state)}</div>`;
}

// One card per ship (D48). Items arrive sorted, so the first cabin seen for a ship is its best match.
export const tallyText = (ships, cabins) =>
  ships === cabins ? `${ships.toLocaleString('en-US')} ships` : `${ships.toLocaleString('en-US')} ships · ${cabins.toLocaleString('en-US')} cabins`;

// Cards for a list of ship groups, with a divider where ships that pass only on unknown data begin (D52).
export function shipCards(groups) {
  const cut = groups.findIndex((g) => g.it.partial);
  const card = (g, i) => html`${i === cut && cut > 0 ? html`<p class="cards-divider">These may also fit, but we can't confirm everything you picked (for example the region or an amenity).</p>` : ''}${cardHtml(g)}`;
  return html`<div class="cards">${groups.map(card)}</div>`;
}

export function byShip(items) {
  const groups = new Map();
  for (const it of items) {
    const g = groups.get(it.ship.ship_id);
    if (g) g.more += 1;
    else groups.set(it.ship.ship_id, { it, more: 0 });
  }
  return [...groups.values()];
}

const factsLine = (it) => [
  it.score == null ? null : `Match ${Math.round(it.score)}`,
  `${(it.ship.gt / 1000).toFixed(0)}k GT`,
  `Built ${it.ship.year_built}`,
  it.row.sqft_min == null ? null : `${it.row.sqft_min}+ sq ft`,
].filter(Boolean).join(' · ');

// The other cabins on a card's ship, in the current sort order; each opens to its own breakdown.
export function otherCabinsHtml(list) {
  return html`<div class="others">
    <h3>Other cabins on this ship</h3>
    ${list.map((it) => html`<details class="cabin" data-id="${it.row.row_id}"><summary>
      <span class="cabin-name">${cardTitle(it.row)}</span>
      <span class="cabin-price">${priceCell(it.priced)}</span>
      <span class="cabin-facts">${[it.score == null ? null : `Match ${Math.round(it.score)}`, it.row.sqft_min == null ? null : `${it.row.sqft_min}+ sq ft`].filter(Boolean).join(' · ')}</span>
    </summary></details>`)}
  </div>`;
}

export function scoreCell(it) {
  if (it.score == null) return unknown('—');
  const s = Math.round(it.score);
  return html`${s}<span class="bar"><i style="width:${s}%"></i></span>`;
}

// Regions present in the data, in a fixed geographic order (D58).
const REGION_ORDER = ['Caribbean', 'Bermuda & Canada', 'Alaska', 'Mexico & Pacific Coast', 'Hawaii', 'Mediterranean',
  'Northern Europe', 'Asia', 'Australia & Pacific', 'South America'];
export function regionOptions(data) {
  const present = new Set(data.ships.flatMap((s) => s.regions || []));
  return REGION_ORDER.filter((r) => present.has(r)).map((r) => [r, r]);
}

// Stale badge (D56): the oldest of the tier, ship and line check dates is more than six months old.
const STALE_DAYS = 183;
export function staleDate(it, now = Date.now()) {
  const oldest = [it.row.last_verified, it.ship.last_verified, it.line.last_verified].filter(Boolean).sort()[0];
  return oldest && (now - Date.parse(oldest)) / 864e5 > STALE_DAYS ? oldest : null;
}
export const staleBadge = (it) => {
  const d = staleDate(it);
  return d ? html`<span class="stale" title="Some details were last checked ${d}. Confirm with the cruise line.">May be out of date</span>` : '';
};

// Card used by Simple and Wizard modes.
// Cards use one label for the basic cabin types, which lines spell differently ("Oceanview", "Verandah"),
// and drop the parenthetical category list from other tier names. The detail panel keeps the line's own name.
const PLAIN_TYPES = { interior: 'Inside', oceanview: 'Ocean view', balcony: 'Balcony' };
const cardTitle = (row) => PLAIN_TYPES[row.tier_type] ?? row.name.replace(/\s*\(.*\)\s*$/, '');

export function cardHtml({ it, more }) {
  const { row, ship, line, priced } = it;
  const chips = perkChips(row, ship).slice(0, 3);
  return html`<details class="card" data-id="${row.row_id}">
    <summary>
      <div class="card-top">
        <div class="card-head">
          <h3 class="card-title">${cardTitle(row)}</h3>
          <p class="ship-name">${ship.name} · ${line.name}</p>
          ${staleBadge(it)}
        </div>
        <div class="card-price">${priceCell(priced)}</div>
      </div>
      <p class="card-facts">${factsLine(it)}</p>
      ${chips.length ? chipList(chips) : ''}
      ${more ? html`<p class="card-more">+${more} more cabin${more === 1 ? '' : 's'} on this ship</p>` : ''}
    </summary>
  </details>`;
}
