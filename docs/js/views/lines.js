// "Every cruise line" on the quiz results (D76, D77): each line's match with its best-fitting ship, why a line scores
// lower (answers it misses, data it lacks), where you differ from a line, and two lines side by side.
import { html } from '../dom.js';
import { AXES, gap } from '../axes.js';
import { costNote } from './common.js';
import { personaFor } from './persona.js';

// Plain words for a ship sitting below / above the visitor on each axis.
const WORDS = {
  budget: ['cheaper', 'pricier'], inclusive: ['less included', 'more included'], size: ['smaller', 'bigger'],
  adults: ['more family-oriented', 'more grown-up'], action: ['calmer', 'busier'], newness: ['older', 'newer'],
  suite: ['plainer', 'plusher'],
};
const CLOSE = 8;
const MAX_COMPARE = 2;

// One entry per line, in the same order and with the same % as the result card (nothing is ruled out, D77).
function lineEntries(items, compass, state) {
  if (!items.length) return [];
  const { best, rest } = personaFor(items, compass);
  return [best, ...rest].map((it) => ({ it, pct: it.fit, note: costNote(it, state) }));
}

// How a ship sits against the visitor on one axis, in words.
function verdict(k, want, at) {
  if (at == null) return 'no data';
  const g = gap(k, want, at);
  const word = WORDS[k][at > want ? 1 : 0];
  if (g === 0 && Math.abs(at - want) > CLOSE) return `${word}, which suits you`;
  return g <= CLOSE ? 'about right' : `${word} than you want`;
}

const setAxes = (compass) => AXES.filter(([k]) => compass[k] != null);
const wifiText = (row) => (row.wifi_included === true ? 'included' : row.wifi_included === false ? 'not included' : 'no data');

// marks: [{ cls, at, name }]: the visitor first, then one or two lines.
function axisRow([k, left, right], compass, marks) {
  const label = marks.map((m) => `${m.name} ${m.at ?? 'no data'}`).join(', ');
  return html`<div class="axis-bar">
    <div class="axis-ends"><span>${left}</span><span>${right}</span></div>
    <div class="track" role="img" aria-label="${left} to ${right}: ${label}">
      ${marks.filter((m) => m.at != null).map((m) => html`<i class="mk ${m.cls}" style="left:${m.at}%"></i>`)}
    </div>
    <p class="axis-say">${marks.slice(1).map((m) => html`<span><i class="key ${m.cls}"></i>${m.short}: ${verdict(k, compass[k], m.at)}</span>`)}</p>
  </div>`;
}

// For one line: its fit with your leanings, what it loses and why, as a sum that ends at its %.
function scoreLine(e) {
  const { it } = e;
  if (!it.penalty) return '';
  return html`<p class="score-sum">${it.fit + it.penalty}% fit with your leanings · ${e.note[0].toLowerCase()}${e.note.slice(1)} → <strong>${it.fit}%</strong></p>`;
}

function diffView(entries, compass, state) {
  const [a, b] = entries;
  const marks = (k) => [{ cls: 'you', at: compass[k], name: 'You' },
    ...entries.map((e, i) => ({ cls: i ? 'other' : 'top', at: e.it.ax[k], name: e.it.line.name, short: b ? e.it.line.name : 'This line' }))];
  return html`<div class="axis-bars">
    ${b ? '' : scoreLine(a)}
    ${setAxes(compass).map((ax) => axisRow(ax, compass, marks(ax[0])))}
    ${state.wifiPref ? html`<p class="axis-say"><strong>Wi-Fi in the fare:</strong> ${a.it.line.name} ${wifiText(a.it.row)}${b ? `, ${b.it.line.name} ${wifiText(b.it.row)}` : ''}</p>` : ''}
  </div>`;
}

function comparePanel(entries, compass, state) {
  if (!entries.length) return '';
  if (entries.length === 1) return html`<p class="hint compare-hint">${entries[0].it.line.name} picked. Tick one more line to compare.</p>`;
  const [a, b] = entries;
  return html`<section class="compare" aria-label="${a.it.line.name} and ${b.it.line.name} compared">
    <p class="legend"><span><i class="key you"></i>You</span>
      <span><i class="key top"></i>${a.it.line.name} ${a.pct}% (${a.it.ship.name})</span>
      <span><i class="key other"></i>${b.it.line.name} ${b.pct}% (${b.it.ship.name})</span></p>
    ${diffView(entries, compass, state)}
  </section>`;
}

// items: the quiz results (every cabin, scored); compare: line ids ticked (at most two); open: line ids whose rows
// are expanded.
export function lineList({ items, state, typeLabel, compare, open }) {
  const { compass } = state;
  const entries = lineEntries(items, compass, state);
  const picked = compare.map((id) => entries.find((e) => e.it.line.line_id === id)).filter(Boolean);
  const full = picked.length >= MAX_COMPARE;
  return html`<section class="lines" aria-labelledby="lines-h">
    <h2 class="quiz-title" id="lines-h">Every cruise line</h2>
    <p class="hint">Your match with each line's best-fitting ship. Nothing is ruled out: a line that misses an answer scores lower, and the row says why. Open a line to see where you differ, or tick two to compare.</p>
    ${comparePanel(picked, compass, state)}
    <ol class="line-list">${entries.map((e) => {
      const id = e.it.line.line_id;
      const on = compare.includes(id);
      return html`<li class="line-row">
        <label class="cmp"><input type="checkbox" data-cmp="${id}" ${on ? html`checked` : ''} ${full && !on ? html`disabled` : ''}><span class="sr-only">Compare ${e.it.line.name}</span></label>
        <details data-line="${id}" ${open.has(id) ? html`open` : ''}>
          <summary>
            <span class="ln">${e.it.line.name}</span>
            <span class="pct">${e.pct ?? '—'}%</span>
            <span class="meter" aria-hidden="true"><i style="width:${e.pct ?? 0}%"></i></span>
            <span class="sub">${typeLabel(id)} · best: ${e.it.ship.name}</span>
            ${e.note ? html`<span class="sub miss">${e.note}</span>` : ''}
          </summary>
          ${diffView([e], compass, state)}
        </details>
      </li>`;
    })}</ol>
  </section>`;
}
