// "Help me choose": a short decision tree. Each answer maps onto the same state the other modes use.
import { $, html, mount } from '../dom.js';
import { fresh, store, toggleIn } from '../state.js';
import { cardHtml, rankSummary, weightSliders } from './common.js';

const ALL = 'all';
const add = (list, values) => values.reduce((acc, v) => toggleIn(acc, v, true), list);

// show(answers) decides whether a question is asked; apply(answer, state) writes its effect.
export const QUESTIONS = [
  { id: 'who', title: "Who's going?", options: [
      ['adults', 'Two or more adults'], ['family', 'A family with kids'], ['solo', 'Just me']],
    apply: (a, s) => { if (a === 'family') s.amen = add(s.amen, ['kids_club']); } },
  { id: 'cabin_size', title: 'How many people will share one cabin?', help: 'Prices on this site still assume two guests per cabin.',
    show: (ans) => ans.who === 'family', options: [['3', 'Three'], ['4', 'Four'], ['5', 'Five'], ['6', 'Six or more']],
    apply: (a, s) => { s.guests = Number(a); } },
  { id: 'adults_only', title: 'Would you rather be on a ship with no kids at all?', help: 'Some lines only take guests 18 and over.',
    show: (ans) => ans.who !== 'family', options: [['yes', 'Yes, adults only'], ['no', "Doesn't matter"]],
    apply: (a, s) => { s.adults = a === 'yes'; } },
  { id: 'nights', title: 'How many nights?', options: [['4', '3–5'], ['7', 'About a week'], ['10', '10 or so'], ['14', 'Two weeks or more']],
    apply: (a, s) => { s.nights = Number(a); } },
  { id: 'budget', title: 'What can you spend per person, per night, all-in?', help: 'Fare plus tips and any drinks or Wi-Fi you want.',
    options: [['200', 'Under $200'], ['400', '$200–400'], ['800', '$400–800'], ['none', 'No set limit']],
    apply: (a, s) => {
      s.maxPrice = a === 'none' ? null : Number(a);
      s.w.price = { 200: 5, 400: 4, 800: 2, none: 1 }[a];
    } },
  { id: 'motion', title: 'Do you get seasick?', help: 'Larger ships usually roll less in a swell.',
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
  { id: 'suite_perks', title: 'Which suite perks matter?', help: 'Pick any. Each one narrows the list.', multi: true,
    show: (ans) => ans.cabin === 'suite',
    options: [['laundry', 'Free laundry'], ['butler', 'A butler'], ['private_restaurant', 'A suites-only restaurant'],
      ['private_lounge', 'A private lounge'], ['priority_boarding', 'Priority boarding']],
    apply: (a, s) => {
      for (const p of a) {
        if (p === 'private_restaurant') s.privRest = true;
        else s.perks = add(s.perks, [p]);
      }
    } },
  { id: 'food', title: 'How much does food matter?', options: [
      ['main', 'The main dining room is fine'], ['few', "I'll pay for a couple of specialty dinners"],
      ['some', 'Some specialty dining should be included'], ['all', 'Every restaurant should be included']],
    apply: (a, s) => {
      if (a === 'few') s.dinners = 2;
      if (a === 'some') s.dining = 'some_specialty';
      if (a === 'all') s.dining = 'all';
      s.w.dining = { main: 1, few: 2, some: 2, all: 3 }[a];
    } },
  { id: 'drinks', title: 'What do you usually drink?', options: [
      ['none', 'Water, coffee, tea'], ['soft', 'Soda and juice'], ['alcohol', 'Cocktails, beer or wine']],
    apply: (a, s) => { s.drinks = a; } },
  { id: 'wifi', title: 'Do you need Wi-Fi on board?', options: [['yes', 'Yes'], ['no', 'No']],
    apply: (a, s) => { s.wifi = a === 'yes'; } },
  { id: 'activities', title: 'Anything you want on the ship?', help: 'Pick any, or skip.', multi: true,
    options: [['pickleball', 'Pickleball'], ['running_track', 'Running track'], ['thermal_suite', 'Thermal spa'],
      ['sports_court', 'Basketball court'], ['self_laundry', 'Self-service laundry']],
    apply: (a, s) => { s.amen = add(s.amen, a); } },
  { id: 'shares', title: 'Do you own 100 or more shares of a cruise company?', help: 'Shareholders get onboard credit on that company’s lines.',
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
  if (Array.isArray(a)) return a.length ? a.map((v) => q.options.find(([k]) => k === v)?.[1]).join(', ') : 'None';
  return q.options.find(([k]) => k === a)?.[1] ?? 'Skipped';
}

function questionView(q, index, total) {
  const current = answers[q.id];
  const picked = (v) => (q.multi ? (current || []).includes(v) : current === v);
  return html`<div class="quiz">
    <p class="quiz-progress">Question ${index + 1} of ${total}</p>
    <div class="quiz-bar"><i style="width:${Math.round((index / total) * 100)}%"></i></div>
    <h2 class="quiz-title">${q.title}</h2>
    ${q.help ? html`<p class="quiz-help">${q.help}</p>` : ''}
    <div class="quiz-options" role="${q.multi ? 'group' : 'radiogroup'}" aria-label="${q.title}">
      ${q.options.map(([v, l]) => html`<button type="button" class="quiz-option" data-v="${v}" role="${q.multi ? 'checkbox' : 'radio'}" aria-checked="${picked(v)}">${l}</button>`)}
    </div>
    <div class="quiz-nav">
      <button type="button" class="btn-ghost" id="q-back" ${index === 0 ? html`disabled` : ''}>Back</button>
      <button type="button" class="btn-ghost" id="q-skip">Skip</button>
      ${q.multi ? html`<button type="button" class="btn-primary" id="q-next">${index + 1 === total ? 'See my matches' : 'Next'}</button>` : ''}
    </div>
  </div>`;
}

function resultsView(items) {
  const qs = visible();
  const top = items.slice(0, 5);
  return html`<div class="quiz-results">
    <div class="results-head">
      <h2 class="quiz-title">Your top ${top.length} match${top.length === 1 ? '' : 'es'}</h2>
      <p class="tally">${items.length} cabin options fit your answers</p>
    </div>
    <p class="rank-summary">${rankSummary(store.state.w)} (set by your answers).</p>
    <details class="finetune" id="q-finetune" ${weightsOpen ? html`open` : ''}>
      <summary>Adjust what matters</summary>
      ${weightSliders(store.state.w, 'q')}
    </details>
    ${top.length ? html`<div class="cards">${top.map((it) => cardHtml(it))}</div>`
      : html`<p class="empty">Nothing fits every answer. Change an answer below, often the budget or a suite perk.</p>`}
    <div class="quiz-actions">
      <button type="button" class="btn-primary" data-goto="simple">See all ${items.length} in Simple view</button>
      <button type="button" class="btn-ghost" data-goto="detailed">Fine-tune in Detailed view</button>
      <button type="button" class="btn-ghost" id="q-restart">Start over</button>
    </div>
    <h3 class="answers-title">Your answers</h3>
    <dl class="answers">${qs.map((q, i) => html`<div><dt>${q.title}</dt><dd>${label(q, answers[q.id])}
      <button type="button" class="link" data-edit="${i}">Change</button></dd></div>`)}</dl>
  </div>`;
}

let lastItems = [];
let weightsOpen = false;

export function renderWizard(items) {
  lastItems = items;
  const panel = $('q-finetune');
  if (panel) weightsOpen = panel.open;
  const qs = visible();
  mount($('mode-wizard'), step < qs.length ? questionView(qs[step], step, qs.length) : resultsView(items));
}

function commit() {
  store.replace({ ...stateFromAnswers(answers), sort: 'score' });
}

function advance() {
  step += 1;
  commit();
  $('mode-wizard').scrollIntoView({ block: 'start' });
}

export function initWizard(goTo) {
  $('mode-wizard').onclick = (e) => {
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
    const id = e.target.id;
    if (id === 'q-next') { answers[q.id] = answers[q.id] || []; advance(); }
    else if (id === 'q-skip') { delete answers[q.id]; advance(); }
    else if (id === 'q-back') { step = Math.max(0, step - 1); renderWizard(lastItems); }
    else if (id === 'q-restart') { answers = {}; step = 0; commit(); }
    else if (e.target.dataset.edit) { step = Number(e.target.dataset.edit); renderWizard(lastItems); }
    else if (e.target.dataset.goto) goTo(e.target.dataset.goto);
  };
}

export function onWizardShow() {
  // Re-entering the wizard starts a fresh quiz unless one is in progress.
  if (!Object.keys(answers).length) step = 0;
}
