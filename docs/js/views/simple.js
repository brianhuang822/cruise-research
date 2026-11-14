// Simple mode: the most-used filters in one bar, results as cards.
import { $, html, mount } from '../dom.js';
import { METRICS, fresh, store, toggleIn } from '../state.js';
import { cardHtml, priorityChips, sortSelect, togglePriority, weightSliders } from './common.js';

const PAGE = 12;
let shown = PAGE;
let engine;

export const CABIN_GROUPS = [
  ['inside', 'Inside', ['interior']],
  ['window', 'Ocean view', ['oceanview']],
  ['balcony', 'Balcony', ['balcony', 'junior_suite', 'perk_class']],
  ['suite', 'Suite', ['suite', 'top_suite']],
];
// Same steps as the wizard's budget question, so a quiz answer always shows here.
const BUDGETS = [['', 'Any'], ['200', 'Up to $200'], ['400', 'Up to $400'], ['800', 'Up to $800']];
const CALM_GT = 120000;

const groupOn = (types, g) => g[2].every((t) => types.includes(t));

// Filters set in Detailed mode that this bar can't show.
function hiddenFilters(s, priced) {
  const grouped = CABIN_GROUPS.filter((g) => groupOn(s.types, g)).flatMap((g) => g[2]);
  const strayTypes = s.types.filter((t) => !grouped.includes(t)).length;
  // Without fares a budget filters nothing, so it isn't worth flagging.
  const budgetShown = !priced || s.maxPrice == null || BUDGETS.some(([v]) => Number(v) === s.maxPrice);
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
  const priced = engine.data.rows.some((r) => r.fare_pppn_median != null);
  return html`<div class="simple-bar">
    <div class="simple-row">
      <div class="chips" id="s-cabins" role="group" aria-label="Cabin type">
        ${CABIN_GROUPS.map((g) => html`<button type="button" class="chip" data-g="${g[0]}" aria-pressed="${groupOn(s.types, g)}">${g[1]}</button>`)}
      </div>
      ${sel('s-guests', [['2', '2 guests'], ['3', '3 guests'], ['4', '4 guests'], ['5', '5 guests'], ['6', '6+ guests']], s.guests, 'Guests')}
      ${priced ? sel('s-budget', BUDGETS, s.maxPrice ?? '', 'Budget per night') : ''}
    </div>
    <div class="toggles">
      ${toggle('s-adults', 'Adults only', s.adults)}
      ${toggle('s-grat', 'Tips included', s.grat)}
      ${toggle('s-wififree', 'Free Wi-Fi', s.wifiFree)}
    </div>
    <details class="more-options" id="s-more-options">
      <summary>More options</summary>
      <div class="more-body">
      <div class="simple-row">
        ${sel('s-nights', [['4', '3–5 nights'], ['6', '6 nights'], ['7', '7 nights'], ['10', '10 nights'], ['14', '14+ nights']], s.nights, 'Trip length')}
        ${sel('s-dining', [['any', 'Any'], ['some_specialty', 'Some specialty'], ['all', 'All restaurants']], s.dining, 'Dining included')}
        ${sel('s-ticker', [['', 'None'], ...tickers.map((t) => [t, t])], s.tickers[0] ?? '', 'Shareholder of')}
      </div>
      <div class="toggles">
        ${toggle('s-drinks', 'Add a drinks package', s.drinks === 'alcohol')}
        ${toggle('s-calm', 'Less motion (120k+ GT)', s.minGt === CALM_GT)}
      </div>
      <div class="chips" id="s-rank">${priorityChips(s.w)}</div>
      ${weightSliders(s.w, 's')}
      </div>
    </details>
  </div>`;
}

function bind() {
  const root = $('mode-simple');
  root.onchange = (e) => {
    const t = e.target;
    const actions = {
      's-nights': () => store.set({ nights: Number(t.value) }),
      's-guests': () => store.set({ guests: Number(t.value) }),
      's-budget': () => store.set({ maxPrice: t.value ? Number(t.value) : null }),
      's-dining': () => store.set({ dining: t.value }),
      's-ticker': () => store.set({ tickers: t.value ? [t.value] : [] }),
      's-grat': () => store.set({ grat: t.checked }),
      's-wififree': () => store.set({ wifiFree: t.checked }),
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
      store.set({ w: togglePriority(store.state.w, k) });
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
  if (rank) mount(rank, priorityChips(w));
  for (const [k] of METRICS) {
    const input = $(`s-w-${k}`);
    if (input) { input.value = String(w[k]); $(`s-wo-${k}`).textContent = String(w[k]); }
  }
}

export function renderSimple(items) {
  lastItems = items;
  const s = store.state;
  const hidden = hiddenFilters(s, engine.data.rows.some((r) => r.fare_pppn_median != null));
  mount($('s-results'), html`
    <div class="results-head">
      <p class="tally">${items.length.toLocaleString('en-US')} cabins</p>
      ${sortSelect('s-sort', s.sort)}
    </div>
    ${hidden ? html`<p class="notice">+${hidden} more filter${hidden === 1 ? '' : 's'} on. <button type="button" class="link" id="s-clear-hidden">Clear</button></p>` : ''}
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
