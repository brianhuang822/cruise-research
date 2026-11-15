// Detailed mode: every filter, score weights, all sorts. Controls are static markup in index.html.
import { $, html, mount } from '../dom.js';
import { activeFilterCount } from '../engine.js';
import { AMENITIES, PERKS, SEGMENTS, TIER_TYPES, fresh, store, toggleIn } from '../state.js';
import { applyPreset, chipList, fareState, perkChips, presetChips, priceCell, rankSummary, scoreCell, staleBadge, typeLabel, weightSliders } from './common.js';

const PAGE = 60;
let shown = PAGE;
let engine;

function chipGroup(el, options, key) {
  const s = store.state;
  mount(el, options.map(([v, label]) => html`<button type="button" class="chip" data-v="${v}" aria-pressed="${String(s[key].includes(v))}">${label}</button>`));
  el.onclick = (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const on = !store.state[key].includes(b.dataset.v);
    b.setAttribute('aria-pressed', String(on));
    store.set({ [key]: toggleIn(store.state[key], b.dataset.v, on) });
  };
}

// Must / Nice (D26, D55): Must filters, Nice raises the score. An item is in at most one of the two lists.
function pickList(el, options, key) {
  const draw = () => {
    const s = store.state;
    mount(el, options.map(([v, label]) => html`<div class="pick" id="${key}-${v}"><span>${label}</span><span class="pick-btns">
      <button type="button" class="chip mini" data-v="${v}" data-level="must" aria-pressed="${String(s[key].includes(v))}" aria-label="Must have: ${label}">Must</button>
      <button type="button" class="chip mini" data-v="${v}" data-level="nice" aria-pressed="${String(s.nice.includes(v))}" aria-label="Nice to have: ${label}">Nice</button>
    </span></div>`));
  };
  draw();
  el.onclick = (e) => {
    const b = e.target.closest('[data-level]');
    if (!b) return;
    const { v, level } = b.dataset;
    const s = store.state;
    const must = level === 'must' ? !s[key].includes(v) : false;
    const nice = level === 'nice' ? !s.nice.includes(v) : false;
    store.set({ [key]: toggleIn(s[key], v, must), nice: toggleIn(s.nice, v, nice) });
    draw();
    mount($('weights'), weightSliders(store.state.w, 'd', store.state.nice.length > 0));
  };
}

function tickerBoxes() {
  const s = store.state;
  const tickers = [...new Set(engine.data.shareholder_benefits.map((b) => b.ticker))].sort();
  mount($('tickers'), tickers.map((t) => {
    const brands = engine.data.lines.filter((l) => l.ticker === t).map((l) => l.name).join(', ') || 'No lines loaded yet';
    return html`<label title="${brands}"><input type="checkbox" id="tk-${t}" value="${t}" ${s.tickers.includes(t) ? html`checked` : ''}> ${t}</label>`;
  }));
}

function syncControls() {
  const s = store.state;
  const data = engine.data;
  $('nights').value = String(s.nights);
  $('drinks').value = s.drinks;
  $('wifi').checked = s.wifi;
  $('dinners').value = String(s.dinners);
  $('f-dining').value = s.dining;
  $('f-privrest').checked = s.privRest;
  $('f-grat').checked = s.grat;
  $('f-wififree').checked = s.wifiFree;
  $('f-adults').checked = s.adults;
  $('f-guests').value = String(s.guests);
  $('u-include').checked = s.unknowns === 'include';
  $('u-exclude').checked = s.unknowns === 'exclude';
  $('sort').value = s.sort;
  $('f-maxprice').value = String(s.maxPrice ?? $('f-maxprice').max);
  $('o-maxprice').textContent = s.maxPrice == null ? 'any' : `$${s.maxPrice}/night`;
  $('f-mingt').value = String(s.minGt);
  $('o-mingt').textContent = s.minGt ? `${(s.minGt / 1000).toFixed(0)}k GT` : 'any';
  tickerBoxes();
  chipGroup($('f-segments'), SEGMENTS.filter(([k]) => data.lines.some((l) => l.segment === k)), 'segments');
  chipGroup($('f-lines'), data.lines.map((l) => [l.line_id, l.name]), 'lines');
  chipGroup($('f-types'), TIER_TYPES.filter(([k]) => data.rows.some((r) => r.tier_type === k)), 'types');
  pickList($('f-perks'), PERKS, 'perks');
  pickList($('f-amen'), AMENITIES, 'amen');
  mount($('weights'), weightSliders(s.w, 'd', s.nice.length > 0));
}

function rowHtml(it) {
  const { row, ship, line, priced } = it;
  const sq = row.sqft_min == null ? html`<span class="unk">—</span>` : row.sqft_max && row.sqft_max !== row.sqft_min ? `${row.sqft_min}–${row.sqft_max}` : `${row.sqft_min}`;
  return html`<details class="row" data-id="${row.row_id}">
    <summary>
      <div class="c-name"><div class="tier-name"><span class="type-badge">${typeLabel(row.tier_type)}</span>${row.name}</div>
        <div class="ship-name">${ship.name} · ${line.name}${it.partial ? html` · <span class="unk">missing data for a filter</span>` : ''}</div>${staleBadge(it)}</div>
      <div class="c-price"><span class="label-m">All-in / pp / night</span>${priceCell(priced)}</div>
      <div class="c-score"><span class="label-m">Score</span><span class="score">${scoreCell(it)}</span></div>
      <div class="c-gt"><span class="label-m">GT</span><span class="num">${(ship.gt / 1000).toFixed(0)}k</span></div>
      <div class="c-year"><span class="label-m">Built</span><span class="num">${ship.year_built}</span>${ship.last_refit ? html`<span class="sub">refit ${ship.last_refit}</span>` : ''}</div>
      <div class="c-sqft"><span class="label-m">Sq ft</span><span class="num">${sq}</span></div>
      <div class="c-perks">${chipList(perkChips(row, ship))}</div>
    </summary>
  </details>`;
}

export function renderDetailed(items) {
  const s = store.state;
  const total = engine.data.rows.length;
  mount($('tally'), html`${items.length.toLocaleString('en-US')} cabin options<span>of ${total.toLocaleString('en-US')}</span>`);
  $('d-rank-summary').textContent = s.sort === 'score' ? rankSummary(s.w) : '';
  const fares = fareState(engine.data);
  const priced = fares !== 'none';
  mount($('d-presets'), presetChips(s.w, priced));
  const fc = activeFilterCount(s);
  $('filter-count').textContent = fc ? `${fc} active` : '';
  $('notice').hidden = fares === 'real';
  $('notice').textContent = fares === 'estimate'
    ? 'Prices marked ~ are estimates: a typical fare for each line and cabin type, plus your extras. Real fares per ship replace them when loaded.'
    : "Fares aren't loaded yet. Each cabin shows its extra cost per night until they are.";
  $('price-hint').textContent = priced ? 'All-in per person per night for your trip settings.' : 'Works once fares are added.';
  if (!items.length) {
    mount($('rows'), html`<p class="empty">No cabins match these filters. Turn one off, or choose Show under “Rows with unknown data”.</p>`);
    $('more').hidden = true;
    return;
  }
  mount($('rows'), items.slice(0, shown).map(rowHtml));
  $('more').hidden = items.length <= shown;
  $('more').textContent = `Show ${Math.min(PAGE, items.length - shown)} more`;
}

export function onDetailedShow() {
  shown = PAGE;
  syncControls();
}

const num = (e) => Number(e.target.value);

export function initDetailed(eng, rerender) {
  engine = eng;
  $('nights').onchange = (e) => store.set({ nights: num(e) });
  $('drinks').onchange = (e) => store.set({ drinks: e.target.value });
  $('wifi').onchange = (e) => store.set({ wifi: e.target.checked });
  $('dinners').oninput = (e) => store.set({ dinners: Math.max(0, Math.min(14, Math.floor(num(e) || 0))) });
  $('tickers').onchange = (e) => store.set({ tickers: toggleIn(store.state.tickers, e.target.value, e.target.checked) });
  $('f-maxprice').oninput = (e) => {
    const v = num(e);
    store.set({ maxPrice: v >= Number(e.target.max) ? null : v });
    $('o-maxprice').textContent = store.state.maxPrice == null ? 'any' : `$${store.state.maxPrice}/night`;
  };
  $('f-mingt').oninput = (e) => {
    store.set({ minGt: num(e) });
    $('o-mingt').textContent = store.state.minGt ? `${(store.state.minGt / 1000).toFixed(0)}k GT` : 'any';
  };
  $('f-dining').onchange = (e) => store.set({ dining: e.target.value });
  $('f-privrest').onchange = (e) => store.set({ privRest: e.target.checked });
  $('f-grat').onchange = (e) => store.set({ grat: e.target.checked });
  $('f-wififree').onchange = (e) => store.set({ wifiFree: e.target.checked });
  $('f-adults').onchange = (e) => store.set({ adults: e.target.checked });
  $('f-guests').onchange = (e) => store.set({ guests: num(e) });
  for (const id of ['u-include', 'u-exclude']) $(id).onchange = (e) => store.set({ unknowns: e.target.value });
  $('sort').onchange = (e) => store.set({ sort: e.target.value });
  $('d-presets').onclick = (e) => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    store.set({ w: applyPreset(store.state.w, b.dataset.preset), sort: 'score' });
    $('sort').value = 'score';
    mount($('weights'), weightSliders(store.state.w, 'd', store.state.nice.length > 0));
  };
  $('reset').onclick = () => {
    const s = store.state;
    store.replace({ ...fresh(), nights: s.nights, tickers: s.tickers, drinks: s.drinks, wifi: s.wifi, dinners: s.dinners, w: s.w, sort: s.sort });
    syncControls();
  };
  $('more').onclick = () => { shown += PAGE; rerender(); };
  if (window.matchMedia('(max-width: 899px)').matches) $('filters-panel').open = false;
}
