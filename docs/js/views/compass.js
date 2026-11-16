// Cruise compass views (D59): the slider screen, the results panel (closest/farthest lines, per-axis bars,
// a two-axis map of ships) and the tooltip for the map. Axis maths lives in ../axes.js.
import { html } from '../dom.js';
import { AXES } from '../axes.js';

const AXIS = Object.fromEntries(AXES.map(([k, left, right]) => [k, { left, right }]));
export const isSet = (compass) => Object.keys(compass).length > 0;

// One row per axis: the two ends, a slider, and "Any" (pressed = this axis doesn't matter).
export function compassSliders(compass, prefix) {
  return html`<div class="axes">${AXES.map(([k, left, right]) => {
    const on = compass[k] != null;
    return html`<div class="axis-row" data-row="${k}">
      <div class="axis-ends"><span>${left}</span><span>${right}</span></div>
      <div class="axis-input">
        <input type="range" id="${prefix}-ax-${k}" data-axis="${k}" min="0" max="100" step="5" value="${String(on ? compass[k] : 50)}" aria-label="${left} to ${right}">
        <button type="button" class="chip mini" data-any="${k}" aria-pressed="${String(!on)}">Any</button>
      </div>
    </div>`;
  })}</div>`;
}

// Farthest lines, read off the same ranked ship list as the cards and the map, so they always agree
// (confirmed matches rank first, D52). The closest lines are on the result card (D63).
function farthestLines(leads) {
  const firstSeen = new Map();
  for (const it of leads) if (!firstSeen.has(it.line.name)) firstSeen.set(it.line.name, it.fit);
  const lines = [...firstSeen];
  return lines.length > 4 ? lines.slice(-2).reverse().map(([n, f]) => `${n} (${f ?? '—'})`).join(', ') : '';
}

// You vs the top match on each axis the visitor set.
function axisBars(compass, top) {
  return html`<div class="axis-bars">${AXES.filter(([k]) => compass[k] != null).map(([k, left, right]) => html`<div class="axis-bar">
    <div class="axis-ends"><span>${left}</span><span>${right}</span></div>
    <div class="track" role="img" aria-label="${left} to ${right}: you ${compass[k]}, top match ${top?.ax[k] ?? 'no data'}">
      ${top?.ax[k] != null ? html`<i class="mk match" style="left:${top.ax[k]}%"></i>` : ''}
      <i class="mk you" style="left:${compass[k]}%"></i>
    </div>
  </div>`)}</div>`;
}

const W = 320;
const H = 230;
const PAD = { l: 26, r: 10, t: 10, b: 30 };
const px = (v) => PAD.l + (v / 100) * (W - PAD.l - PAD.r);
const py = (v) => H - PAD.b - (v / 100) * (H - PAD.t - PAD.b);
const tip = (it, rank) => `${rank ? `#${rank} · ` : ''}${it.ship.name} (${it.line.name}) · match ${it.fit ?? '—'} · ${AXIS.budget.left}–${AXIS.budget.right} ${it.ax.budget} · ${AXIS.action.left}–${AXIS.action.right} ${it.ax.action}`;

// Map: Budget–Splurge across, Relaxed–Action-packed up; one dot per ship (its best-fitting cabin).
function compassMap(leads, compass) {
  // Top 5 are the first five ships in the ranked list (same as the cards); ships missing a map position are skipped.
  const has = (it) => it.ax.budget != null && it.ax.action != null;
  const top = leads.slice(0, 5).map((it, i) => [it, i + 1]).filter(([it]) => has(it));
  const rest = leads.slice(5).filter(has);
  const youOn = compass.budget != null && compass.action != null;
  // Only the best match is labelled on the map: ships of one class share a position, so more labels collide.
  // The legend, tooltip and table carry the rest.
  const dot = (it, cls, r, rank) => {
    const x = px(it.ax.budget);
    const y = py(it.ax.action);
    return html`<g class="pt ${cls}" tabindex="0" data-x="${x}" data-y="${y}" data-tip="${tip(it, rank)}">
      <circle class="mark" cx="${x}" cy="${y}" r="${r}"></circle>
      ${rank === 1 ? html`<text class="lbl" x="${x + 9}" y="${y + 4}">#1</text>` : ''}
    </g>`;
  };
  const grid = [25, 50, 75];
  return html`<figure class="compass-map">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of ships by price and activity; a table version follows">
      ${grid.map((g) => html`<line class="grid" x1="${px(g)}" x2="${px(g)}" y1="${py(0)}" y2="${py(100)}"></line>
        <line class="grid" x1="${px(0)}" x2="${px(100)}" y1="${py(g)}" y2="${py(g)}"></line>`)}
      <rect class="frame" x="${px(0)}" y="${py(100)}" width="${px(100) - px(0)}" height="${py(0) - py(100)}"></rect>
      ${rest.map((it) => dot(it, 'other', 4))}
      ${top.slice().reverse().map(([it, rank]) => dot(it, 'top', 6, rank))}
      ${youOn ? html`<g class="pt you" tabindex="0" data-x="${px(compass.budget)}" data-y="${py(compass.action)}" data-tip="${`You · ${AXIS.budget.left}–${AXIS.budget.right} ${compass.budget} · ${AXIS.action.left}–${AXIS.action.right} ${compass.action}`}">
          <circle class="mark" cx="${px(compass.budget)}" cy="${py(compass.action)}" r="7"></circle>
          <text class="lbl" x="${px(compass.budget) - 10}" y="${py(compass.action) - 10}" text-anchor="end">You</text></g>` : ''}
      <text class="axis-lbl" x="${px(0)}" y="${H - 10}">← ${AXIS.budget.left}</text>
      <text class="axis-lbl end" x="${px(100)}" y="${H - 10}">${AXIS.budget.right} →</text>
      <text class="axis-lbl" transform="rotate(-90)" x="${-py(0)}" y="${PAD.l - 12}">← ${AXIS.action.left}</text>
      <text class="axis-lbl end" transform="rotate(-90)" x="${-py(100)}" y="${PAD.l - 12}">${AXIS.action.right} →</text>
    </svg>
    <figcaption class="legend">
      <span><i class="key top"></i>Top 5 matches</span>
      ${youOn ? html`<span><i class="key you"></i>You</span>` : ''}
      <span><i class="key other"></i>Other ships</span>
      ${youOn ? '' : html`<span class="hint">Set Budget and Action to see yourself on the map.</span>`}
    </figcaption>
    <div class="viz-tip" hidden></div>
  </figure>`;
}

function mapTable(leads) {
  return html`<details class="fold"><summary>Map as a table</summary>
    <table class="map-table"><thead><tr><th>#</th><th>Ship</th><th>Match</th><th>${AXIS.budget.left}–${AXIS.budget.right}</th><th>${AXIS.action.left}–${AXIS.action.right}</th></tr></thead>
    <tbody>${leads.slice(0, 10).map((it, i) => html`<tr><td>${i + 1}</td><td>${it.ship.name}</td><td>${it.fit ?? '—'}</td><td>${it.ax.budget ?? '—'}</td><td>${it.ax.action ?? '—'}</td></tr>`)}</tbody></table>
  </details>`;
}

// groups: ship cards in the order the list shows them, so the map's top 5 are the first five cards.
export function compassPanel(groups, compass) {
  const leads = groups.map((g) => g.it);
  const farthest = farthestLines(leads);
  return html`<section class="compass-panel" aria-label="Your cruise compass">
    ${farthest ? html`<p class="compass-lines"><strong>Farthest from you:</strong> ${farthest}</p>` : ''}
    ${axisBars(compass, leads[0])}
    <p class="legend"><span><i class="key you"></i>You</span><span><i class="key top"></i>Top match</span></p>
    ${compassMap(leads, compass)}
    ${mapTable(leads)}
  </section>`;
}

// Map tooltip: one element per map, filled with textContent. The pointer picks the nearest dot within reach
// (dense clusters make exact hits impractical); keyboard focus picks the focused dot.
function nearest(svg, e) {
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  let best = null;
  let bestD = 18;
  for (const g of svg.querySelectorAll('.pt')) {
    const d = Math.hypot(Number(g.dataset.x) - pt.x, Number(g.dataset.y) - pt.y);
    if (d < bestD) { best = g; bestD = d; }
  }
  return best;
}

export function bindMapTooltip(root) {
  const show = (g) => {
    const fig = g?.closest('.compass-map');
    if (!g || !fig) return;
    const box = fig.querySelector('.viz-tip');
    box.textContent = g.dataset.tip;
    const r = g.getBoundingClientRect();
    const f = fig.getBoundingClientRect();
    box.hidden = false;
    box.style.left = `${Math.min(Math.max(r.left - f.left + r.width / 2, 80), f.width - 80)}px`;
    box.style.top = `${r.top - f.top}px`;
  };
  const hide = (el) => {
    const fig = el.closest?.('.compass-map');
    if (fig) fig.querySelector('.viz-tip').hidden = true;
  };
  root.addEventListener('pointermove', (e) => {
    const svg = e.target.closest?.('.compass-map svg');
    if (!svg) return;
    const g = nearest(svg, e);
    for (const el of svg.querySelectorAll('.pt.active')) el.classList.remove('active');
    if (g) { g.classList.add('active'); show(g); } else hide(svg);
  });
  root.addEventListener('pointerleave', (e) => hide(e.target), true);
  root.addEventListener('focusin', (e) => show(e.target.closest?.('.pt')));
  root.addEventListener('focusout', (e) => hide(e.target));
}
