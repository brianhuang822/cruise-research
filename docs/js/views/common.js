// Rendering pieces shared by all modes. Everything goes through html``, which escapes values.
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

// Weight sliders, shared by every mode. app.js commits a change on release (the 'change' event).
export function weightSliders(w, prefix) {
  return html`<div class="weights-grid">${METRICS.map(([k, label]) => html`<label for="${prefix}-w-${k}"><span>${label}</span>
    <output id="${prefix}-wo-${k}">${w[k]}</output>
    <input type="range" id="${prefix}-w-${k}" data-weight="${k}" min="0" max="5" step="1" value="${w[k]}"></label>`)}</div>`;
}

const SHORT = { price: 'price', gt: 'ship size', newness: 'newness', space: 'space per guest', sqft: 'cabin size', dining: 'restaurants', cdc: 'cleanliness' };
export function rankSummary(w) {
  const on = METRICS.filter(([k]) => w[k] > 0).sort((a, b) => w[b[0]] - w[a[0]]);
  return on.length ? `Ranked by ${on.map(([k]) => `${SHORT[k]} ×${w[k]}`).join(', ')}` : 'No ranking weights set; results are in default order';
}

export const chipList = (labels) => html`<div class="perks">${labels.map((p) => html`<span class="perk">${p}</span>`)}</div>`;

export function priceCell(p) {
  if (p.all_in != null) {
    const how = `${p.method !== 'a_la_carte' ? 'via bundle' : 'fare + extras'}${p.obc ? ' − shareholder credit' : ''}`;
    return html`<span class="price">${fmt$(p.all_in)}</span><small>${how}</small>`;
  }
  if (p.extras != null) return html`<span class="pending">Fare pending</span><small>+${fmt$2(p.extras)}/night in extras</small>`;
  return html`<span class="pending unk">Unknown</span><small>missing: ${p.missing.join(', ')}</small>`;
}

const PART_LABELS = { gratuity: 'Gratuities', drinks: 'Drinks', wifi: 'Wi-Fi', specialty: 'Specialty dinners', bundle: 'Bundle' };

function priceBlock(it, data) {
  const { row, priced: p } = it;
  const bundle = data.bundles.find((b) => b.bundle_id === p.method);
  const parts = Object.entries(p.parts).filter(([, v]) => v > 0);
  return html`<div>
    <h3>Price per person per night</h3>
    <dl>
      <dt>Median fare</dt><dd>${p.fare == null ? unknown('pending') : fmt$2(p.fare)}</dd>
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
  </div>`;
}

function tierBlock(row) {
  const meals = row.specialty_meals_included === 'unlimited' ? 'Unlimited' : row.specialty_meals_included;
  const grat = row.gratuity_pppd == null ? unknown() : row.gratuity_pppd === 0 ? 'Included' : `${fmt$2(row.gratuity_pppd)}/day`;
  return html`<div>
    <h3>Included with this tier</h3>
    <dl>
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
    </dl>
    <a class="sailings" href="${ship.official_url}" target="_blank" rel="noopener">Find sailings on ${line.name} →</a>
  </div>`;
}

function aboutBlock(it, engine, weights) {
  const { row, ship, line } = it;
  const tier = engine.TIERS[row.tier_id];
  const scored = METRICS.filter(([k]) => weights[k] > 0);
  const urls = [...new Set([...row.sources, ...ship.sources, ...line.sources])].map((id) => engine.data.sources[id]).filter(Boolean).sort();
  return html`<div>
    ${scored.length ? html`<h3>Score breakdown (${it.used} of ${it.of} measures)</h3>
      <dl>${scored.map(([k, label]) => html`<dt>${label}</dt><dd>${it.parts[k] == null ? unknown('no data') : `${Math.round(it.parts[k])}th pct`}</dd>`)}</dl>` : ''}
    ${tier?.notes ? html`<h3 class="gap">Notes</h3><p>${tier.notes}</p>` : ''}
    ${row.overridden.length ? html`<p class="hint">Different on this ship: ${row.overridden.join(', ').replace(/_/g, ' ')}.</p>` : ''}
    <h3 class="gap">Sources · checked ${row.last_verified}</h3>
    <ul class="sources">${urls.map((u) => html`<li><a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 80)}</a></li>`)}</ul>
  </div>`;
}

export function detailHtml(it, engine, weights) {
  return html`<div class="detail">${priceBlock(it, engine.data)}${tierBlock(it.row)}${shipBlock(it.ship, it.line)}${aboutBlock(it, engine, weights)}</div>`;
}

export function scoreCell(it) {
  if (it.score == null) return unknown('—');
  const s = Math.round(it.score);
  return html`${s}<span class="bar"><i style="width:${s}%"></i></span>`;
}

// Card used by Simple and Wizard modes.
export function cardHtml(it, extra = '') {
  const { row, ship, line, priced } = it;
  const chips = perkChips(row, ship).slice(0, 5);
  return html`<details class="card" data-id="${row.row_id}">
    <summary>
      <div class="card-top">
        <div>
          <span class="type-badge">${typeLabel(row.tier_type)}</span>
          <h3 class="card-title">${row.name}</h3>
          <p class="ship-name">${ship.name} · ${line.name}</p>
        </div>
        <div class="card-price">${priceCell(priced)}</div>
      </div>
      <dl class="card-facts">
        <div><dt>Match</dt><dd class="score">${scoreCell(it)}</dd></div>
        <div><dt>Ship size</dt><dd>${(ship.gt / 1000).toFixed(0)}k GT</dd></div>
        <div><dt>Built</dt><dd>${ship.year_built}</dd></div>
        <div><dt>Cabin</dt><dd>${row.sqft_min == null ? '—' : `${row.sqft_min}+ sq ft`}</dd></div>
      </dl>
      ${chips.length ? chipList(chips) : ''}
      ${extra}
      <span class="card-more">Details</span>
    </summary>
  </details>`;
}
