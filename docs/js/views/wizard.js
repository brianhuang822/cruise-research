// "Help me choose": a short decision tree. Each answer maps onto the same state the other modes use, and many
// answers also place the visitor on the cruise compass (D66), which ranks the results.
import { $, html, mount } from '../dom.js';
import { lineTypes } from '../engine.js';
import { fresh, store, toggleIn } from '../state.js';
import { byShip, shipCards, sortSelect, tallyText } from './common.js';
import { bindMapTooltip, compassPanel, compassSliders, isSet } from './compass.js';
import { lineList } from './lines.js';
import { onPersonaClick, personaCard } from './persona.js';

// Filled from the data in initWizard: line ids for each line type (see lineTypes), and the reverse.
let LINE_TYPES = {};
let TYPE_OF = {};
const add = (list, values) => values.reduce((acc, v) => toggleIn(acc, v, true), list);
// Fares are estimates (D57), so a budget limit has leeway rather than cutting off a line for a few dollars (D64).
const BUDGET_LEEWAY = 1.15;

// show(answers) decides whether a question is asked; apply(answer, state) writes its effect; axes(answer, answers)
// returns compass positions the answer stands for. Several answers on one axis average (stateFromAnswers).
export const QUESTIONS = [
  { id: 'who', title: 'Are any kids coming?', options: [['family', 'Yes'], ['adults', 'No, just adults']],
    apply: (a, s) => { if (a === 'family') s.amen = add(s.amen, ['kids_club']); },
    axes: (a) => (a === 'family' ? { adults: 10 } : {}) },
  { id: 'cabin_size', title: 'How many people will share one cabin?', help: 'Prices still assume two per cabin.',
    show: (ans) => ans.who === 'family', options: [['3', 'Three'], ['4', 'Four'], ['5', 'Five'], ['6', 'Six or more']],
    apply: (a, s) => { s.guests = Number(a); } },
  { id: 'adults_only', title: 'How do you feel about kids on board?',
    show: (ans) => ans.who !== 'family',
    options: [['yes', 'Adults only, please'], ['mostly', 'A few are fine, but I want a grown-up feel'], ['no', "Doesn't matter"]],
    apply: (a, s) => { s.adults = a === 'yes'; },
    axes: (a) => ({ yes: { adults: 95 }, mostly: { adults: 80 } })[a] ?? {} },
  { id: 'vibe', title: 'What should the ship feel like?', options: [
      ['party', 'Lively and late: pool parties, bars, nightlife'], ['lively', 'Fun, but not wild'],
      ['quiet', 'Calm and grown-up: talks, wine, early nights']],
    apply: () => {},
    axes: (a, ans) => ({ party: { action: 90, size: 75 }, lively: { action: 65 }, quiet: { action: 10, ...(ans.who === 'family' ? {} : { adults: 80 }) } })[a] ?? {} },
  { id: 'focus', title: 'Is the ship the destination, or the places you visit?', options: [
      ['ship', 'The ship: I want lots to do on board'], ['both', 'A bit of both'], ['ports', 'The places: more time ashore, smaller ships']],
    apply: () => {},
    axes: (a) => ({ ship: { size: 85, action: 80 }, ports: { size: 15 } })[a] ?? {} },
  { id: 'regions', title: 'Where would you like to go?', help: 'Skip for anywhere. Ships confirmed to sail there rank higher.', multi: true,
    options: [['Caribbean', 'Caribbean & Bahamas'], ['Alaska', 'Alaska'], ['Mediterranean', 'Mediterranean'], ['Northern Europe', 'Northern Europe'],
      ['Asia', 'Asia'], ['Australia & Pacific', 'Australia & South Pacific'], ['Mexico & Pacific Coast', 'Mexico & Pacific Coast'], ['Bermuda & Canada', 'Bermuda & Canada'], ['Hawaii', 'Hawaii'],
      ['South America', 'South America']],
    apply: (a, s) => { s.regions = [...a]; } },
  { id: 'food', title: 'How much does the food matter?', options: [
      ['highlight', 'A highlight: great restaurants included in the fare'], ['good', 'Good food is enough; paying extra for a special dinner is fine']],
    apply: () => {},
    axes: (a) => (a === 'highlight' ? { inclusive: 85 } : {}) },
  // D67 (amends D50): name types to avoid rather than pick them, so first-timers who don't know the types lose nothing.
  // D77: avoided types score lower; nothing is hidden.
  { id: 'line_type', title: "Any kind of cruise line you'd rather avoid?", multi: true,
    help: "Skip if you're open to all. Kinds you pick score lower. Every line includes a buffet and a main dining room with waiters.",
    options: [
      ['mainstream', 'Mainstream', 'Carnival, Royal Caribbean, NCL, MSC, Disney. Big ships with the most to do; specialty restaurants extra.'],
      ['premium', 'Premium', 'Celebrity, Princess, Holland America, Cunard, Azamara. A step up in food and service; specialty restaurants extra.'],
      ['specialty_included', 'Premium, every restaurant included', 'Oceania, Viking, Virgin Voyages. Specialty restaurants and Wi-Fi in the fare.'],
      ['luxury', 'Luxury, nearly everything included', 'Regent, Seabourn, Silversea, Crystal, Explora, Ritz-Carlton. Smaller ships; dining, drinks, tips and Wi-Fi included.']],
    apply: (a, s) => {
      const out = new Set(a.flatMap((k) => LINE_TYPES[k] ?? []));
      const keep = Object.values(LINE_TYPES).flat().filter((id) => !out.has(id));
      if (out.size && keep.length) s.lines = keep;
    } },
  { id: 'cabin', title: 'What kind of cabin?', options: [
      ['interior', 'Inside is fine'], ['oceanview', 'I want a window'], ['balcony', 'A balcony'],
      ['suite', 'A suite with perks'], ['all', 'Not sure yet']],
    apply: (a, s) => {
      const map = { interior: ['interior'], oceanview: ['oceanview'], balcony: ['balcony', 'junior_suite', 'perk_class'], suite: ['suite', 'top_suite'] };
      if (map[a]) s.types = map[a];
    },
    axes: (a) => ({ suite: { suite: 90 }, interior: { suite: 15 } })[a] ?? {} },
  { id: 'suite_perks', title: 'Which suite perks matter?', multi: true,
    show: (ans) => ans.cabin === 'suite',
    options: [['laundry', 'Free laundry'], ['butler', 'A butler'], ['private_restaurant', 'A suites-only restaurant'],
      ['private_lounge', 'A private lounge'], ['priority_boarding', 'Priority boarding']],
    apply: (a, s) => {
      for (const p of a) {
        if (p === 'private_restaurant') s.privRest = true;
        else s.perks = add(s.perks, [p]);
      }
    } },
  { id: 'drinks', title: 'What do you usually drink?', options: [
      ['none', 'Water, coffee, tea'], ['soft', 'Soda and juice'], ['alcohol', 'Cocktails, beer or wine']],
    apply: (a, s) => { s.drinks = a; } },
  // D70 (amends D42 for the quiz): "rather it were included" is a preference, not the free-Wi-Fi filter. Wi-Fi is priced
  // into the all-in fare either way, and the filter emptied about a third of the quizzes that ended with nothing.
  // D74: the preference is its own term in the fit (Wi-Fi included or not), not a vote on the whole All-inclusive axis.
  { id: 'wifi', title: 'Do you need Wi-Fi?', options: [
      ['free', "Yes, and I'd rather it were included"], ['pay', "Yes, I'll pay for it"], ['no', "I don't need it"]],
    apply: (a, s) => {
      s.wifi = a !== 'no';
      s.wifiPref = a === 'free';
    } },
  { id: 'budget', title: 'What can you spend per person, per night, all-in?',
    help: 'Fare plus tips and the drinks and Wi-Fi you picked. Fares are estimates for now, so each limit has some leeway.',
    options: [['200', 'Up to about $200'], ['400', 'About $200–400'], ['800', 'About $400–800'],
      ['top', 'More than $800: I want the best'], ['none', 'No set limit']],
    apply: (a, s) => {
      s.maxPrice = a === 'none' || a === 'top' ? null : Math.round(Number(a) * BUDGET_LEEWAY);
      s.w.price = { 200: 5, 400: 4, 800: 2, top: 1, none: 1 }[a];
    },
    // D71: "the best" is the quiz's luxury lever (price is the plainest signal of it); "No set limit" stays neutral.
    axes: (a) => ({ 200: { budget: 15 }, 800: { budget: 75 }, top: { budget: 90 } })[a] ?? {} },
  // D66: seasickness ranks bigger ships higher instead of hiding every ship under 120,000 GT.
  { id: 'motion', title: 'Do you get seasick?', help: 'Bigger ships usually roll less. The route and a low, midship cabin matter too.',
    // D69: "A little" changed nothing once the compass was set, and a mild vote for size cost small ships too much.
    options: [['easily', 'Yes, easily'], ['no', 'No, or only a little']],
    apply: (a, s) => { s.w.gt = { easily: 4, no: 1 }[a]; },
    axes: (a) => (a === 'easily' ? { size: 85 } : {}) },
  { id: 'activities', title: 'Anything you want on the ship?', help: 'Ships confirmed to have them rank higher.', multi: true,
    options: [['adults_only_pool', 'Adults-only pool'], ['covered_pool', 'Covered or indoor pool'],
      ['promenade_deck', 'Walk-around promenade deck'], ['running_track', 'Running track'], ['pickleball', 'Pickleball'],
      ['thermal_free', 'Free thermal spa'], ['self_laundry', 'Self-service laundry'], ['new_ship', 'A new or recently refitted ship']],
    apply: (a, s) => { s.amen = add(s.amen, a.filter((x) => x !== 'new_ship')); },
    axes: (a) => (a.includes('new_ship') ? { newness: 85 } : {}) },
  { id: 'kids', title: 'Anything for the kids?', multi: true, show: (ans) => ans.who === 'family',
    options: [['water_slides', 'Water slides'], ['splash_area', 'Splash area for little ones'], ['teen_club', 'Teen club']],
    apply: (a, s) => { s.amen = add(s.amen, a); } },
  { id: 'shares', title: 'Do you own 100 or more shares of a cruise company?', help: 'Shareholders get onboard credit.',
    multi: true, options: [['CCL', 'Carnival Corp (CCL)'], ['RCL', 'Royal Caribbean Group (RCL)'], ['NCLH', 'Norwegian Cruise Line Holdings (NCLH)']],
    apply: (a, s) => { s.tickers = [...a]; } },
];

let answers = {};
let step = 0;

const visible = () => QUESTIONS.filter((q) => !q.show || q.show(answers));
const average = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

export function stateFromAnswers(ans) {
  const s = fresh();
  const votes = {};
  for (const q of QUESTIONS) {
    if ((q.show && !q.show(ans)) || ans[q.id] == null) continue;
    q.apply(ans[q.id], s);
    for (const [k, v] of Object.entries(q.axes?.(ans[q.id], ans) ?? {})) (votes[k] ||= []).push(v);
  }
  s.compass = Object.fromEntries(Object.entries(votes).map(([k, vs]) => [k, average(vs)]));
  return s;
}

function label(q, a) {
  if (Array.isArray(a)) return a.length ? a.map((v) => q.options.find(([k]) => k === v)?.[1]).join(', ') : 'None';
  return q.options.find(([k]) => k === a)?.[1] ?? 'Skipped';
}

function questionView(q, index, total) {
  const current = answers[q.id];
  const picked = (v) => (q.multi ? (current || []).includes(v) : current === v);
  const pct = Math.round((index / total) * 100);
  return html`<div class="quiz">
    <div class="quiz-bar" role="progressbar" aria-label="Question ${index + 1} of ${total}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
    <h2 class="quiz-title">${q.title}</h2>
    ${q.help ? html`<p class="quiz-help">${q.help}</p>` : ''}
    <p class="quiz-kind">${q.multi ? 'Pick all that apply' : 'Pick one'}</p>
    <div class="quiz-options" role="${q.multi ? 'group' : 'radiogroup'}" aria-label="${q.title}">
      ${q.options.map(([v, l, sub]) => html`<button type="button" class="quiz-option" data-v="${v}" role="${q.multi ? 'checkbox' : 'radio'}" aria-checked="${String(picked(v))}"><span>${l}</span>${sub ? html`<small>${sub}</small>` : ''}</button>`)}
    </div>
    <div class="quiz-nav">
      <button type="button" class="link" id="q-back" ${index === 0 ? html`disabled` : ''}>Back</button>
      <button type="button" class="link" id="q-skip">Skip</button>
      ${q.multi ? html`<button type="button" class="btn-primary" id="q-next">${index + 1 === total ? 'See my matches' : 'Next'}</button>` : ''}
    </div>
  </div>`;
}

const TOP = 5;
const PER_LINE = 2;
let shown = TOP;

// In Best match, at most two ships of a line lead the list so it shows real alternatives (ships of a line share
// one estimated fare, so they tie); the rest follow in order (D68).
function spread(groups) {
  const count = {};
  const first = [];
  const later = [];
  for (const g of groups) {
    const id = g.it.line.line_id;
    count[id] = (count[id] || 0) + 1;
    (count[id] <= PER_LINE ? first : later).push(g);
  }
  return [...first, ...later];
}

function resultsView(items) {
  const qs = visible();
  const s = store.state;
  const byShipList = byShip(items);
  const ships = s.sort === 'score' ? spread(byShipList) : byShipList;
  const top = ships.slice(0, shown);
  return html`<div class="quiz-results">
    ${personaCard(items, s.compass, typeLabel)}
    ${isSet(s.compass) ? lineList({ items, state: s, typeLabel, compare, open: openLines }) : ''}
    <div class="results-head">
      <h2 class="quiz-title">Your matches</h2>
      <p class="tally">${tallyText(ships.length, items.length)}</p>
    </div>
    <div class="rerank">
      <p class="rank-summary">${isSet(s.compass) ? 'Ranked by how closely each ship fits your answers. Nothing is hidden: a ship that misses an answer scores lower, and its card says why.' : 'Ranked by price and ship size. Answer more questions, or set your compass below, to rank by fit.'}</p>
      ${sortSelect('q-sort', s.sort)}
    </div>
    ${isSet(s.compass) && items.length ? compassPanel(ships, s.compass) : ''}
    ${shipCards(top)}
    ${ships.length > shown ? html`<button type="button" class="btn-more" id="q-more">Show 5 more ships</button>` : ''}
    <div class="quiz-actions">
      <button type="button" class="btn-primary" data-goto="simple">Browse and filter all ships</button>
      <button type="button" class="link" id="q-restart">Start over</button>
    </div>
    <details class="fold" id="q-answers" ${open.answers ? html`open` : ''}>
      <summary>Your answers</summary>
      <dl class="answers">${qs.map((q, i) => html`<div><dt>${q.title}</dt><dd>${label(q, answers[q.id])}
        <button type="button" class="link" data-edit="${i}">Change</button></dd></div>`)}</dl>
    </details>
    <details class="fold" id="q-finetune" ${open.weights ? html`open` : ''}>
      <summary>Adjust your compass</summary>
      <p class="hint">Your answers set these. Slide to fine-tune; "Any" means that one doesn't matter.</p>
      ${compassSliders(s.compass, 'rc')}
    </details>
  </div>`;
}

let lastItems = [];
const open = { answers: false, weights: false };
// "Every cruise line" (D76): lines ticked to compare (at most two) and rows the visitor opened.
let compare = [];
const openLines = new Set();
const MAX_COMPARE = 2;

export function renderWizard(items) {
  lastItems = items;
  // Keep the folded panels as the user left them across re-renders.
  if ($('q-answers')) open.answers = $('q-answers').open;
  if ($('q-finetune')) open.weights = $('q-finetune').open;
  const rows = document.querySelectorAll('#mode-wizard details[data-line]');
  if (rows.length) {
    openLines.clear();
    for (const d of rows) if (d.open) openLines.add(d.dataset.line);
  }
  const qs = visible();
  mount($('mode-wizard'), step < qs.length ? questionView(qs[step], step, qs.length) : resultsView(items));
}

function commit() {
  shown = TOP;
  store.replace({ ...stateFromAnswers(answers), sort: 'score' });
}

function advance() {
  step += 1;
  commit();
  $('mode-wizard').scrollIntoView({ block: 'start' });
}

// The quiz's own name for a line's type (D50), e.g. "Premium, every restaurant included".
const typeLabel = (lineId) => QUESTIONS.find((q) => q.id === 'line_type').options.find(([k]) => k === TYPE_OF[lineId])?.[1] ?? '';

export function initWizard(goTo, data) {
  LINE_TYPES = lineTypes(data);
  TYPE_OF = Object.fromEntries(Object.entries(LINE_TYPES).flatMap(([type, ids]) => ids.map((id) => [id, type])));
  $('mode-wizard').onclick = (e) => {
    if (onPersonaClick(e)) return;
    const qs = visible();
    const q = qs[step];
    const opt = e.target.closest('.quiz-option');
    if (opt && q) {
      if (q.multi) {
        answers[q.id] = toggleIn(answers[q.id] || [], opt.dataset.v, opt.getAttribute('aria-checked') !== 'true');
        renderWizard(lastItems);
      } else {
        answers[q.id] = opt.dataset.v;
        advance();
      }
      return;
    }
    const any = e.target.closest('[data-any]');
    if (any) { toggleAny(any); return; }
    const id = e.target.id;
    if (id === 'q-next') { answers[q.id] = answers[q.id] || []; advance(); }
    else if (id === 'q-skip') { delete answers[q.id]; advance(); }
    else if (id === 'q-back') { step = Math.max(0, step - 1); renderWizard(lastItems); }
    else if (id === 'q-restart') { answers = {}; step = 0; compare = []; openLines.clear(); commit(); }
    else if (id === 'q-more') { shown += TOP; renderWizard(lastItems); }
    else if (e.target.dataset.edit) { step = Number(e.target.dataset.edit); renderWizard(lastItems); }
    else if (e.target.dataset.goto) goTo(e.target.dataset.goto);
  };
  $('mode-wizard').onchange = (e) => {
    if (e.target.id === 'q-sort') store.set({ sort: e.target.value });
    const cmp = e.target.dataset.cmp;
    if (cmp) {
      compare = e.target.checked ? [...compare, cmp].slice(-MAX_COMPARE) : compare.filter((x) => x !== cmp);
      renderWizard(lastItems);
      return;
    }
    // Results page: commit a compass slider on release and re-rank.
    const k = e.target.dataset.axis;
    if (k) store.set({ compass: { ...store.state.compass, [k]: Number(e.target.value) }, sort: 'score' });
  };
  // While dragging, a moved slider is no longer "Any".
  $('mode-wizard').oninput = (e) => {
    if (e.target.dataset.axis) e.target.parentElement.querySelector('[data-any]').setAttribute('aria-pressed', 'false');
  };
  bindMapTooltip($('mode-wizard'));
}

// "Any" on: drop that axis. "Any" off: use the slider's current value.
function toggleAny(btn) {
  const k = btn.dataset.any;
  const nowAny = btn.getAttribute('aria-pressed') !== 'true';
  const out = { ...store.state.compass };
  if (nowAny) delete out[k];
  else out[k] = Number(btn.parentElement.querySelector('[data-axis]').value);
  store.set({ compass: out, sort: 'score' });
}

export function onWizardShow() {
  // Re-entering the wizard starts a fresh quiz unless one is in progress.
  if (!Object.keys(answers).length) step = 0;
}
