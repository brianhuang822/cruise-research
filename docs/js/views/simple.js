// Simple mode: the most-used filters in one bar, results as cards.
import { $, html, mount } from '../dom.js';
import { fresh, store, toggleIn } from '../state.js';
import { applyPreset, byShip, fareState, presetChips, regionOptions, shipCards, sortSelect, tallyText } from './common.js';

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
const BUDGETS = [['', 'Any budget'], ['200', 'Up to $200/night'], ['400', 'Up to $400/night'], ['800', 'Up to $800/night']];
const CALM_GT = 120000;

const groupOn = (types, g) => g[2].every((t) => types.includes(t));
const hasFares = () => fareState(engine.data) !== 'none';

// Filters set in Detailed mode that this bar can't show.
function hiddenFilters(s, priced) {
  const grouped = CABIN_GROUPS.filter((g) => groupOn(s.types, g)).flatMap((g) => g[2]);
  const strayTypes = s.types.filter((t) => !grouped.includes(t)).length;
  // Without fares a budget filters nothing, so it isn't worth flagging.
  const budgetShown = !priced || s.maxPrice == null || BUDGETS.some(([v]) => Number(v) === s.maxPrice);
  return (
    // A line or segment list is one filter however many it names.
    Math.sign(s.segments.length) + Math.sign(s.lines.length) + (s.regions.length > 1 ? 1 : 0) + s.perks.length + s.amen.length + s.nice.length + strayTypes +
    [s.privRest, !budgetShown, s.minGt > 0 && s.minGt !== CALM_GT, s.unknowns === 'exclude', s.dining === 'some_specialty'].filter(Boolean).length
  );
}

function controls() {
  const s = store.state;
  // Each menu's options name themselves ("2 guests", "Any dining"), so there is no visible label.
  const sel = (id, options, value, label) => html`<select class="pick" id="${id}" aria-label="${label}">
    ${options.map(([v, l]) => html`<option value="${v}" ${String(value) === v ? html`selected` : ''}>${l}</option>`)}</select>`;
  const toggle = (id, label, on) => html`<label class="toggle"><input type="checkbox" id="${id}" ${on ? html`checked` : ''}><span>${label}</span></label>`;
  const tickers = [...new Set(engine.data.shareholder_benefits.map((b) => b.ticker))].sort();
  const priced = hasFares();
  return html`<div class="simple-bar">
    <div class="simple-row">
      <div class="chips" id="s-cabins" role="group" aria-label="Cabin type">
        ${CABIN_GROUPS.map((g) => html`<button type="button" class="chip" data-g="${g[0]}" aria-pressed="${String(groupOn(s.types, g))}">${g[1]}</button>`)}
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
        ${sel('s-dining', [['any', 'Any dining'], ['all', 'Specialty dining included']], s.dining, 'Included dining')}
        ${sel('s-ticker', [['', 'No cruise shares'], ...tickers.map((t) => [t, `I own ${t} shares`])], s.tickers[0] ?? '', 'Shareholder of')}
        ${sel('s-region', [['', 'Any region'], ...regionOptions(engine.data)], s.regions.length === 1 ? s.regions[0] : '', 'Region')}
      </div>
      <div class="toggles">
        ${toggle('s-drinks', 'Add a drinks package', s.drinks === 'alcohol')}
        ${toggle('s-calm', 'Less motion (120k+ GT)', s.minGt === CALM_GT)}
      </div>
      <div class="chips" id="s-presets">${presetChips(s.w, priced)}</div>
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
      's-region': () => store.set({ regions: t.value ? [t.value] : [] }),
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
    const preset = e.target.closest('[data-preset]');
    if (preset) {
      shown = PAGE;
      store.set({ w: applyPreset(store.state.w, preset.dataset.preset), sort: 'score', compass: {} });
      mount($('s-presets'), presetChips(store.state.w, hasFares()));
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
      store.set({ segments: d.segments, lines: d.lines, perks: d.perks, amen: d.amen, nice: d.nice, privRest: false, unknowns: 'include',
        types: s.types.filter((t) => grouped.includes(t)), minGt: s.minGt === CALM_GT ? CALM_GT : 0,
        maxPrice: BUDGETS.some(([v]) => Number(v) === s.maxPrice) ? s.maxPrice : null });
      onSimpleShow();
    }
    if (e.target.id === 's-more') { shown += PAGE; renderSimple(lastItems); }
    if (e.target.id === 's-clear-compass') store.set({ compass: {} });
  };
}

let lastItems = [];

export function renderSimple(items) {
  lastItems = items;
  const s = store.state;
  const hidden = hiddenFilters(s, hasFares());
  const ships = byShip(items);
  mount($('s-results'), html`
    <div class="results-head">
      <p class="tally">${tallyText(ships.length, items.length)}</p>
      ${sortSelect('s-sort', s.sort)}
    </div>
    ${Object.keys(s.compass).length ? html`<p class="notice">Best match uses your compass from Help me choose. <button type="button" class="link" id="s-clear-compass">Clear</button></p>` : ''}
    ${hidden ? html`<p class="notice">+${hidden} more setting${hidden === 1 ? '' : 's'} from other modes. <button type="button" class="link" id="s-clear-hidden">Clear</button></p>` : ''}
    ${items.length
      ? html`${shipCards(ships.slice(0, shown))}
        ${ships.length > shown ? html`<button type="button" class="btn-more" id="s-more">Show ${Math.min(PAGE, ships.length - shown)} more ships</button>` : ''}`
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
