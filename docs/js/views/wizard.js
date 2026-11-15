// "Help me choose": a short decision tree. Each answer maps onto the same state the other modes use.
import { $, html, mount } from '../dom.js';
import { lineTypes } from '../engine.js';
import { fresh, store, toggleIn } from '../state.js';
import { byShip, shipCards, sortSelect, tallyText } from './common.js';
import { bindMapTooltip, compassPanel, compassSliders, isSet } from './compass.js';
import { onPersonaClick, personaCard } from './persona.js';

const ALL = 'all';
// Filled from the data in initWizard: line ids for each line type (see lineTypes).
let LINE_TYPES = {};
let TYPE_OF = {};
const add = (list, values) => values.reduce((acc, v) => toggleIn(acc, v, true), list);

// show(answers) decides whether a question is asked; apply(answer, state) writes its effect.
export const QUESTIONS = [
  { id: 'who', title: "Who's going?", options: [
      ['adults', 'Two or more adults'], ['family', 'A family with kids'], ['solo', 'Just me']],
    apply: (a, s) => { if (a === 'family') s.amen = add(s.amen, ['kids_club']); } },
  { id: 'cabin_size', title: 'How many people will share one cabin?', help: 'Prices still assume two per cabin.',
    show: (ans) => ans.who === 'family', options: [['3', 'Three'], ['4', 'Four'], ['5', 'Five'], ['6', 'Six or more']],
    apply: (a, s) => { s.guests = Number(a); } },
  { id: 'adults_only', title: 'Would you rather be on a ship with no kids at all?',
    show: (ans) => ans.who !== 'family', options: [['yes', 'Yes, adults only'], ['no', "Doesn't matter"]],
    apply: (a, s) => { s.adults = a === 'yes'; } },
  { id: 'regions', title: 'Where would you like to go?', help: 'Skip for anywhere. Ships confirmed to sail there come first.', multi: true,
    options: [['Caribbean', 'Caribbean & Bahamas'], ['Alaska', 'Alaska'], ['Mediterranean', 'Mediterranean'], ['Northern Europe', 'Northern Europe'],
      ['Asia', 'Asia'], ['Australia & Pacific', 'Australia & South Pacific'], ['Mexico & Pacific Coast', 'Mexico & Pacific Coast'], ['Bermuda & Canada', 'Bermuda & Canada']],
    apply: (a, s) => { s.regions = [...a]; } },
  { id: 'nights', title: 'How many nights?', options: [['4', '3–5'], ['7', 'About a week'], ['10', '10 or so'], ['14', 'Two weeks or more']],
    apply: (a, s) => { s.nights = Number(a); } },
  { id: 'budget', title: 'What can you spend per person, per night, all-in?', help: 'Fare plus tips, drinks and Wi-Fi.',
    options: [['200', 'Under $200'], ['400', '$200–400'], ['800', '$400–800'], ['none', 'No set limit']],
    apply: (a, s) => {
      s.maxPrice = a === 'none' ? null : Number(a);
      s.w.price = { 200: 5, 400: 4, 800: 2, none: 1 }[a];
    } },
  { id: 'motion', title: 'Do you get seasick?', help: 'Bigger ships usually roll less.',
    options: [['easily', 'Yes, easily'], ['little', 'A little'], ['no', 'Not at all']],
    apply: (a, s) => {
      if (a === 'easily') s.minGt = 120000;
      s.w.gt = { easily: 4, little: 3, no: 1 }[a];
    } },
  { id: 'cabin', title: 'What kind of cabin?', options: [
      ['interior', 'Inside is fine'], ['oceanview', 'I want a window'], ['balcony', 'A balcony'],
      ['suite', 'A suite with perks'], [ALL, 'Not sure yet']],
    apply: (a, s) => {
      const map = { interior: ['interior'], oceanview: ['oceanview'], balcony: ['balcony', 'junior_suite', 'perk_class'], suite: ['suite', 'top_suite'] };
      if (map[a]) s.types = map[a];
    } },
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
  { id: 'line_type', title: 'What kind of cruise line?', multi: true,
    help: 'Every line includes a buffet and a main dining room with waiters.',
    options: [
      ['mainstream', 'Mainstream', 'Carnival, Royal Caribbean, NCL, MSC, Disney. Big ships with the most to do; specialty restaurants extra.'],
      ['premium', 'Premium', 'Celebrity, Princess, Holland America, Cunard, Azamara. A step up in food and service; specialty restaurants extra.'],
      ['specialty_included', 'Premium, every restaurant included', 'Oceania, Viking, Virgin Voyages. Specialty restaurants and Wi-Fi in the fare.'],
      ['luxury', 'Luxury, nearly everything included', 'Regent, Seabourn, Silversea, Crystal, Explora, Ritz-Carlton. Smaller ships; dining, drinks, tips and Wi-Fi included.']],
    apply: (a, s) => {
      const ids = a.flatMap((k) => LINE_TYPES[k] ?? []);
      if (ids.length) s.lines = ids;
    } },
  { id: 'drinks', title: 'What do you usually drink?', options: [
      ['none', 'Water, coffee, tea'], ['soft', 'Soda and juice'], ['alcohol', 'Cocktails, beer or wine']],
    apply: (a, s) => { s.drinks = a; } },
  { id: 'wifi', title: 'Do you need Wi-Fi, and should it be free?', options: [
      ['free', 'Yes, and it must be free'], ['pay', "Yes, I'll pay for it"], ['no', "I don't need it"]],
    apply: (a, s) => {
      s.wifi = a !== 'no';
      s.wifiFree = a === 'free';
    } },
  { id: 'activities', title: 'Anything you want on the ship?', help: 'Ships confirmed to have them are listed first.', multi: true,
    options: [['adults_only_pool', 'Adults-only pool'], ['covered_pool', 'Covered or indoor pool'],
      ['promenade_deck', 'Walk-around promenade deck'], ['running_track', 'Running track'], ['pickleball', 'Pickleball'],
      ['thermal_free', 'Free thermal spa'], ['self_laundry', 'Self-service laundry']],
    apply: (a, s) => { s.amen = add(s.amen, a); } },
  { id: 'kids', title: 'Anything for the kids?', multi: true, show: (ans) => ans.who === 'family',
    options: [['water_slides', 'Water slides'], ['splash_area', 'Splash area for little ones'], ['teen_club', 'Teen club']],
    apply: (a, s) => { s.amen = add(s.amen, a); } },
  // Cruise compass (D59): one screen of two-ended sliders; "Any" means that axis doesn't matter.
  { id: 'compass', type: 'compass', title: 'Where do you sit?', help: 'Slide toward what you prefer. Leave "Any" on where you don\'t mind.',
    apply: (a, s) => { s.compass = { ...a }; } },
  { id: 'shares', title: 'Do you own 100 or more shares of a cruise company?', help: 'Shareholders get onboard credit.',
    multi: true, options: [['CCL', 'Carnival Corp (CCL)'], ['RCL', 'Royal Caribbean Group (RCL)'], ['NCLH', 'Norwegian Cruise Line Holdings (NCLH)']],
    apply: (a, s) => { s.tickers = [...a]; } },
];

let answers = {};
let step = 0;

const visible = () => QUESTIONS.filter((q) => !q.show || q.show(answers));

export function stateFromAnswers(ans) {
  const s = fresh();
  for (const q of QUESTIONS) {
    if ((q.show && !q.show(ans)) || ans[q.id] == null) continue;
    q.apply(ans[q.id], s);
  }
  return s;
}

function label(q, a) {
  if (q.type === 'compass') return a ? `${Object.keys(a).length} of 7 set` : 'Skipped';
  if (Array.isArray(a)) return a.length ? a.map((v) => q.options.find(([k]) => k === v)?.[1]).join(', ') : 'None';
  return q.options.find(([k]) => k === a)?.[1] ?? 'Skipped';
}

function questionView(q, index, total) {
  const current = answers[q.id];
  const picked = (v) => (q.multi ? (current || []).includes(v) : current === v);
  const pct = Math.round((index / total) * 100);
  const body = q.type === 'compass'
    ? compassSliders(current || {}, 'qc')
    : html`<p class="quiz-kind">${q.multi ? 'Pick all that apply' : 'Pick one'}</p>
    <div class="quiz-options" role="${q.multi ? 'group' : 'radiogroup'}" aria-label="${q.title}">
      ${q.options.map(([v, l, sub]) => html`<button type="button" class="quiz-option" data-v="${v}" role="${q.multi ? 'checkbox' : 'radio'}" aria-checked="${String(picked(v))}"><span>${l}</span>${sub ? html`<small>${sub}</small>` : ''}</button>`)}
    </div>`;
  return html`<div class="quiz">
    <div class="quiz-bar" role="progressbar" aria-label="Question ${index + 1} of ${total}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
    <h2 class="quiz-title">${q.title}</h2>
    ${q.help ? html`<p class="quiz-help">${q.help}</p>` : ''}
    ${body}
    <div class="quiz-nav">
      <button type="button" class="link" id="q-back" ${index === 0 ? html`disabled` : ''}>Back</button>
      <button type="button" class="link" id="q-skip">Skip</button>
      ${q.multi || q.type === 'compass' ? html`<button type="button" class="btn-primary" id="q-next">${index + 1 === total ? 'See my matches' : 'Next'}</button>` : ''}
    </div>
  </div>`;
}

const TOP = 5;
let shown = TOP;

function resultsView(items) {
  const qs = visible();
  const s = store.state;
  const ships = byShip(items);
  const top = ships.slice(0, shown);
  return html`<div class="quiz-results">
    ${personaCard(items, s.compass, answers, typeLabel)}
    <div class="results-head">
      <h2 class="quiz-title">Your matches</h2>
      <p class="tally">${tallyText(ships.length, items.length)}</p>
    </div>
    <div class="rerank">
      <p class="rank-summary">${isSet(s.compass) ? 'Ranked by your compass.' : 'Set your compass below to rank by fit.'}</p>
      ${sortSelect('q-sort', s.sort)}
    </div>
    ${isSet(s.compass) && items.length ? compassPanel(items, s.compass) : ''}
    ${top.length ? html`${shipCards(top)}
        ${ships.length > shown ? html`<button type="button" class="btn-more" id="q-more">Show 5 more ships</button>` : ''}`
      : html`<p class="empty">Nothing fits every answer. Try changing the budget or a suite perk.</p>`}
    <div class="quiz-actions">
      <button type="button" class="btn-primary" data-goto="simple">See all ${ships.length} ships</button>
      <button type="button" class="link" id="q-restart">Start over</button>
    </div>
    <details class="fold" id="q-answers" ${open.answers ? html`open` : ''}>
      <summary>Your answers</summary>
      <dl class="answers">${qs.map((q, i) => html`<div><dt>${q.title}</dt><dd>${label(q, answers[q.id])}
        <button type="button" class="link" data-edit="${i}">Change</button></dd></div>`)}</dl>
    </details>
    <details class="fold" id="q-finetune" ${open.weights ? html`open` : ''}>
      <summary>Adjust your compass</summary>
      ${compassSliders(s.compass, 'rc')}
    </details>
  </div>`;
}

let lastItems = [];
const open = { answers: false, weights: false };

export function renderWizard(items) {
  lastItems = items;
  // Keep the folded panels as the user left them across re-renders.
  if ($('q-answers')) open.answers = $('q-answers').open;
  if ($('q-finetune')) open.weights = $('q-finetune').open;
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
    if (any) { toggleAny(any, q); return; }
    const id = e.target.id;
    if (id === 'q-next') { answers[q.id] = answers[q.id] || (q.type === 'compass' ? {} : []); advance(); }
    else if (id === 'q-skip') { delete answers[q.id]; advance(); }
    else if (id === 'q-back') { step = Math.max(0, step - 1); renderWizard(lastItems); }
    else if (id === 'q-restart') { answers = {}; step = 0; commit(); }
    else if (id === 'q-more') { shown += TOP; renderWizard(lastItems); }
    else if (e.target.dataset.edit) { step = Number(e.target.dataset.edit); renderWizard(lastItems); }
    else if (e.target.dataset.goto) goTo(e.target.dataset.goto);
  };
  $('mode-wizard').onchange = (e) => {
    if (e.target.id === 'q-sort') store.set({ sort: e.target.value });
    // Results page: commit a compass slider on release and re-rank.
    const k = e.target.dataset.axis;
    if (k && !visible()[step]) store.set({ compass: { ...store.state.compass, [k]: Number(e.target.value) }, sort: 'score' });
  };
  // While dragging: in the quiz record the value; anywhere, a moved slider is no longer "Any".
  $('mode-wizard').oninput = (e) => {
    const k = e.target.dataset.axis;
    if (!k) return;
    e.target.parentElement.querySelector('[data-any]').setAttribute('aria-pressed', 'false');
    const q = visible()[step];
    if (q?.type === 'compass') answers.compass = { ...answers.compass, [k]: Number(e.target.value) };
  };
  bindMapTooltip($('mode-wizard'));
}

// "Any" on: drop that axis. "Any" off: use the slider's current value.
function toggleAny(btn, q) {
  const k = btn.dataset.any;
  const nowAny = btn.getAttribute('aria-pressed') !== 'true';
  const value = Number(btn.parentElement.querySelector('[data-axis]').value);
  const next = (c) => {
    const out = { ...c };
    if (nowAny) delete out[k];
    else out[k] = value;
    return out;
  };
  if (q?.type === 'compass') {
    answers.compass = next(answers.compass || {});
    btn.setAttribute('aria-pressed', String(nowAny));
  } else {
    store.set({ compass: next(store.state.compass), sort: 'score' });
  }
}

export function onWizardShow() {
  // Re-entering the wizard starts a fresh quiz unless one is in progress.
  if (!Object.keys(answers).length) step = 0;
}
