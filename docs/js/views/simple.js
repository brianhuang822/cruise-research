// Simple mode: the most-used filters in one bar, results as cards.
import { $, html, mount } from '../dom.js';
import { METRICS, fresh, store, toggleIn } from '../state.js';
import { cardHtml, rankSummary, weightSliders } from './common.js';

const PAGE = 12;
let shown = PAGE;
let engine;

export const CABIN_GROUPS = [
  ['inside', 'Inside', ['interior']],
  ['window', 'Ocean view', ['oceanview']],
  ['balcony', 'Balcony', ['balcony', 'junior_suite', 'perk_class']],
  ['suite', 'Suite', ['suite', 'top_suite']],
];
const BUDGETS = [['', 'Any budget'], ['150', 'Up to $150'], ['250', 'Up to $250'], ['400', 'Up to $400'], ['600', 'Up to $600'], ['1000', 'Up to $1,000']];
const SORTS = [['score', 'Best match'], ['price', 'Lowest price'], ['gt', 'Biggest ship'], ['newness', 'Newest ship']];
const CALM_GT = 120000;
const PRIORITIES = [['price', 'Low price'], ['gt', 'Big ship'], ['newness', 'New ship'], ['sqft', 'Big cabin'],
  ['dining', 'Restaurants'], ['cdc', 'Cleanliness'], ['space', 'Space per guest']];
const ON = 4;
const OFF = 1;
const isOn = (w, k) => w[k] >= 3;

function priorities(w) {
  return html`<span class="rank-label">What matters most?</span>
    ${PRIORITIES.map(([k, l]) => html`<button type="button" class="chip" data-rank="${k}" aria-pressed="${isOn(w, k)}">${l}</button>`)}`;
}

const groupOn = (types, g) => g[2].every((t) => types.includes(t));

// Filters set in Detailed mode that this bar can't show.
function hiddenFilters(s) {
  const grouped = CABIN_GROUPS.filter((g) => groupOn(s.types, g)).flatMap((g) => g[2]);
  const strayTypes = s.types.filter((t) => !grouped.includes(t)).length;
  const budgetShown = s.maxPrice == null || BUDGETS.some(([v]) => Number(v) === s.maxPrice);
  return (
    s.segments.length + s.lines.length + s.perks.length + s.amen.length + strayTypes +
    [s.privRest, !budgetShown, s.minGt > 0 && s.minGt !== CALM_GT, s.unknowns === 'exclude'].filter(Boolean).length
  );
}

function controls() {
  const s = store.state;
  const sel = (id, options, value, label) => html`<label class="field"><span>${label}</span>
    <select id="${id}">${options.map(([v, l]) => html`<option value="${v}" ${String(value) === v ? html`selected` : ''}>${l}</option>`)}</select></label>`;
  const toggle = (id, label, on) => html`<label class="toggle"><input type="checkbox" id="${id}" ${on ? html`checked` : ''}><span>${label}</span></label>`;
  const tickers = [...new Set(engine.data.shareholder_benefits.map((b) => b.ticker))].sort();
  return html`<div class="simple-bar">
    <div class="simple-row">
      ${sel('s-nights', [['4', '3–5 nights'], ['6', '6 nights'], ['7', '7 nights'], ['10', '10 nights'], ['14', '14+ nights']], s.nights, 'Trip length')}
      ${sel('s-budget', BUDGETS, s.maxPrice ?? '', 'All-in per person per night')}
      ${sel('s-dining', [['any', 'Any'], ['some_specialty', 'Some specialty included'], ['all', 'All restaurants included']], s.dining, 'Included dining')}
      ${sel('s-ticker', [['', 'None'], ...tickers.map((t) => [t, t])], s.tickers[0] ?? '', 'Shareholder of')}
    </div>
    <div class="simple-row">
      <div class="field"><span>Cabin</span><div class="chips" id="s-cabins">
        ${CABIN_GROUPS.map((g) => html`<button type="button" class="chip" data-g="${g[0]}" aria-pressed="${groupOn(s.types, g)}">${g[1]}</button>`)}
      </div></div>
      <div class="toggles">
        ${toggle('s-grat', 'Gratuities included', s.grat)}
        ${toggle('s-adults', 'Adults-only ship', s.adults)}
        ${toggle('s-drinks', 'Add a drinks package', s.drinks === 'alcohol')}
        ${toggle('s-calm', 'Less motion (120k+ GT)', s.minGt === CALM_GT)}
      </div>
    </div>
    <div class="simple-row rank-row">
      <div class="chips" id="s-rank">${priorities(s.w)}</div>
      <details class="finetune" id="s-finetune">
        <summary>Fine-tune</summary>
        ${weightSliders(s.w, 's')}
        <p class="hint">0 ignores a measure, 5 makes it count most. Each measure is ranked against the cabins shown.</p>
      </details>
    </div>
  </div>`;
}

function bind() {
  const root = $('mode-simple');
  root.onchange = (e) => {
    const t = e.target;
    const actions = {
      's-nights': () => store.set({ nights: Number(t.value) }),
      's-budget': () => store.set({ maxPrice: t.value ? Number(t.value) : null }),
      's-dining': () => store.set({ dining: t.value }),
      's-ticker': () => store.set({ tickers: t.value ? [t.value] : [] }),
      's-grat': () => store.set({ grat: t.checked }),
      's-adults': () => store.set({ adults: t.checked }),
      's-drinks': () => store.set({ drinks: t.checked ? 'alcohol' : 'none' }),
      's-calm': () => store.set({ minGt: t.checked ? CALM_GT : 0 }),
      's-sort': () => store.set({ sort: t.value }),
    };
    if (actions[t.id]) {
      shown = PAGE;
      actions[t.id]();
    }
  };
  root.onclick = (e) => {
    const rank = e.target.closest('[data-rank]');
    if (rank) {
      const k = rank.dataset.rank;
      store.set({ w: { ...store.state.w, [k]: isOn(store.state.w, k) ? OFF : ON } });
      syncWeights();
      return;
    }
    const chip = e.target.closest('[data-g]');
    if (chip) {
      const g = CABIN_GROUPS.find(([k]) => k === chip.dataset.g);
      const on = !groupOn(store.state.types, g);
      const types = g[2].reduce((acc, t) => toggleIn(acc, t, on), store.state.types);
      chip.setAttribute('aria-pressed', String(on));
      shown = PAGE;
      store.set({ types });
    }
    if (e.target.id === 's-clear-hidden') {
      const s = store.state;
      const d = fresh();
      const grouped = CABIN_GROUPS.filter((gr) => groupOn(s.types, gr)).flatMap((gr) => gr[2]);
      store.set({ segments: d.segments, lines: d.lines, perks: d.perks, amen: d.amen, privRest: false, unknowns: 'include',
        types: s.types.filter((t) => grouped.includes(t)), minGt: s.minGt === CALM_GT ? CALM_GT : 0,
        maxPrice: BUDGETS.some(([v]) => Number(v) === s.maxPrice) ? s.maxPrice : null });
      onSimpleShow();
    }
    if (e.target.id === 's-more') { shown += PAGE; renderSimple(lastItems); }
  };
}

let lastItems = [];

// Keep chips and sliders in step after any weight change.
export function syncWeights() {
  const w = store.state.w;
  const rank = $('s-rank');
  if (rank) mount(rank, priorities(w));
  for (const [k] of METRICS) {
    const input = $(`s-w-${k}`);
    if (input) { input.value = String(w[k]); $(`s-wo-${k}`).textContent = String(w[k]); }
  }
}

export function renderSimple(items) {
  lastItems = items;
  const s = store.state;
  const hidden = hiddenFilters(s);
  const priced = engine.data.rows.some((r) => r.fare_pppn_median != null);
  mount($('s-results'), html`
    <div class="results-head">
      <div><p class="tally">${items.length.toLocaleString('en-US')} cabin options</p>
        ${s.sort === 'score' ? html`<p class="rank-summary">${rankSummary(s.w)}</p>` : ''}</div>
      <label class="sortbox" for="s-sort">Sort
        <select id="s-sort">${(SORTS.some(([v]) => v === s.sort) ? SORTS : [...SORTS, [s.sort, 'Custom (from Detailed)']]).map(([v, l]) => html`<option value="${v}" ${s.sort === v ? html`selected` : ''}>${l}</option>`)}</select></label>
    </div>
    ${hidden ? html`<p class="notice">${hidden} more filter${hidden === 1 ? ' is' : 's are'} on from Detailed mode. <button type="button" class="link" id="s-clear-hidden">Clear them</button></p>` : ''}
    ${priced ? '' : html`<p class="notice">Fares aren't loaded yet, so prices show the extra cost per night (gratuities plus any drinks package) and the budget filter has no effect.</p>`}
    ${items.length
      ? html`<div class="cards">${items.slice(0, shown).map((it) => cardHtml(it))}</div>
        ${items.length > shown ? html`<button type="button" class="btn-more" id="s-more">Show ${Math.min(PAGE, items.length - shown)} more</button>` : ''}`
      : html`<p class="empty">No cabins match. Try a bigger budget or fewer toggles.</p>`}`);
}

export function onSimpleShow() {
  shown = PAGE;
  mount($('s-controls'), controls());
}

export function initSimple(eng) {
  engine = eng;
  bind();
}
