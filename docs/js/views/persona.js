// Quiz result card (D63): your kind of cruise line, named like a personality type, with copy and share.
import { html } from '../dom.js';
import { AXES } from '../axes.js';
import { sortItems } from '../engine.js';
import { byShip } from './common.js';

// Per axis: [left pole, right pole], each [adjective, noun]. The strongest leaning gives the noun, the next the adjective.
const POLES = {
  budget: [['Savvy', 'Bargain Hunter'], ['Lavish', 'Splurger']],
  inclusive: [['À-la-carte', 'Free Spirit'], ['All-Inclusive', 'All-Inclusivist']],
  size: [['Small-Ship', 'Yachtie'], ['Big-Ship', 'Mega-Shipper']],
  adults: [['Family-First', 'Family Captain'], ['Grown-Up', 'Escapist']],
  action: [['Laid-Back', 'Lounger'], ['Adventurous', 'Thrill-Seeker']],
  newness: [['Old-School', 'Traditionalist'], ['Trend-Chasing', 'Trendsetter']],
  suite: [['Practical', 'Pragmatist'], ['Suite-Life', 'Suite Seeker']],
};
// How far from the middle (50) a position must sit to count as a leaning.
const MIN_LEAN = 20;
// Answers that imply a leaning on an axis the compass left on "Any". A compass setting always wins.
const IMPLIED = [
  ['budget', (a) => ({ 200: 15, 800: 75 })[a.budget]],
  ['adults', (a) => ({ family: 10 })[a.who] ?? ({ yes: 90 })[a.adults_only]],
  ['suite', (a) => ({ suite: 90, interior: 15 })[a.cabin]],
  ['size', (a) => ({ easily: 85 })[a.motion]],
];
const SITE = 'https://brianhuang822.github.io/cruise-research/';

export function leanings(compass, answers) {
  const pos = {};
  for (const [k, f] of IMPLIED) {
    const v = f(answers);
    if (v != null) pos[k] = v;
  }
  Object.assign(pos, compass);
  return AXES.filter(([k]) => pos[k] != null && Math.abs(pos[k] - 50) >= MIN_LEAN)
    .map(([k, left, right]) => ({ k, side: pos[k] > 50 ? 1 : 0, label: pos[k] > 50 ? right : left, strength: Math.abs(pos[k] - 50) }))
    .sort((a, b) => b.strength - a.strength);
}

export function personaName(leans) {
  const [first, second] = leans;
  if (!first) return 'The Open-Minded Cruiser';
  const noun = POLES[first.k][first.side][1];
  return second ? `The ${POLES[second.k][second.side][0]} ${noun}` : `The ${noun}`;
}

// The site's own address when served over http(s); the published address inside a preview frame.
const siteUrl = () => (location.protocol.startsWith('http') && location.origin !== 'null' ? location.origin + location.pathname : SITE);

// Lines in the order of their best ship by match, whatever sort the list below uses (confirmed matches first, D52).
function rankedLines(items) {
  const seen = new Map();
  for (const { it } of byShip(sortItems([...items], 'score'))) if (!seen.has(it.line.line_id)) seen.set(it.line.line_id, it);
  return [...seen.values()];
}

export function personaCard(items, compass, answers, typeLabel) {
  if (!items.length) return '';
  const [best, ...rest] = rankedLines(items);
  const leans = leanings(compass, answers);
  const name = personaName(leans);
  const pct = (it) => (it.fit != null ? ` ${it.fit}%` : '');
  const text = `My kind of cruise is ${best.line.name}: ${name}${best.fit != null ? ` (${best.fit}% match)` : ''}. What's yours?`;
  const canShare = typeof navigator.share === 'function';
  return html`<section class="persona" aria-labelledby="persona-line">
    <p class="persona-kicker">Your kind of cruise is</p>
    <h2 class="persona-line" id="persona-line">${best.line.name}</h2>
    <p class="persona-type">${name}</p>
    ${leans.length ? html`<ul class="persona-traits" aria-label="Your leanings">${leans.slice(0, 3).map((l) => html`<li>${l.label}</li>`)}</ul>` : ''}
    <p class="persona-facts">${typeLabel(best.line.line_id)} · Best ship: ${best.ship.name}${best.fit != null ? ` · ${best.fit}% match` : ''}</p>
    ${rest.length ? html`<p class="persona-also">Also your kind: ${rest.slice(0, 2).map((it) => `${it.line.name}${pct(it)}`).join(' · ')}</p>` : ''}
    <div class="persona-actions" data-text="${text}" data-url="${siteUrl()}">
      <button type="button" class="btn-invert" id="p-copy">Copy</button>
      ${canShare ? html`<button type="button" class="btn-invert" id="p-share">Share</button>` : ''}
      <span class="persona-status" role="status"></span>
    </div>
  </section>`;
}

async function copyResult(box) {
  const status = box.querySelector('.persona-status');
  const all = `${box.dataset.text} ${box.dataset.url}`;
  try {
    await navigator.clipboard.writeText(all);
    status.textContent = 'Copied';
    setTimeout(() => { status.textContent = ''; }, 2000);
  } catch {
    status.textContent = `Couldn't copy here. Your result: ${all}`;
  }
}

// Click handler for the card's buttons; returns true when it handled the click.
export function onPersonaClick(e) {
  const btn = e.target.closest('#p-copy, #p-share');
  if (!btn) return false;
  const box = btn.closest('.persona-actions');
  if (btn.id === 'p-copy') copyResult(box);
  else {
    navigator.share({ title: 'Your Kind of Cruise', text: box.dataset.text, url: box.dataset.url })
      .catch((err) => { if (err.name !== 'AbortError') copyResult(box); });
  }
  return true;
}
