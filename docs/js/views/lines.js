// "Every cruise line" on the quiz results (D76): each line's match with its best-fitting ship, lines your answers
// rule out (with their match and the reason), where you differ from a line, and two lines side by side.
import { html } from '../dom.js';
import { AXES, gap } from '../axes.js';
import { AMENITIES, PERKS } from '../state.js';
import { personaFor } from './persona.js';

// Plain words for a ship sitting below / above the visitor on each axis.
const WORDS = {
  budget: ['cheaper', 'pricier'], inclusive: ['less included', 'more included'], size: ['smaller', 'bigger'],
  adults: ['more family-oriented', 'more grown-up'], action: ['calmer', 'busier'], newness: ['older', 'newer'],
  suite: ['plainer', 'plusher'],
};
const CLOSE = 8;
const MAX_COMPARE = 2;
const CABIN = { interior: 'inside', oceanview: 'ocean-view', balcony: 'balcony', suite: 'suite' };
const LABEL = Object.fromEntries([...PERKS, ...AMENITIES]);

// Why a filter rules a cabin out, in the visitor's terms.
function reason(name, state) {
  const [kind, key] = name.split(':');
  if (kind === 'perk' || kind === 'amen') return `no ${(LABEL[key] ?? key.replace(/_/g, ' ')).toLowerCase()}`;
  const text = {
    segments: 'a kind of line you ruled out', lines: 'a kind of line you ruled out',
    types: `no ${CABIN[state.types[0]] ?? 'such'} cabins`, regions: "doesn't sail where you picked",
    maxPrice: 'over your budget', minGt: 'ships too small', dining: 'restaurants not included',
    privRest: 'no suites-only restaurant', grat: 'tips not included', wifiFree: 'Wi-Fi not included',
    adults: 'not adults-only', guests: `cabins don't sleep ${state.guests}`,
  };
  return text[kind] ?? kind;
}

// One entry per line: lines with a ship that fits, in the same order and with the same % as the result card,
// then lines every cabin of which fails an answer, by match. A ruled-out line stands for its cabin that fails the
// fewest answers (then fits best), so the reason shown is the smallest change that would bring the line back.
export function lineEntries(items, all, compass, state) {
  const fits = items.length ? (({ best, rest }) => [best, ...rest])(personaFor(items, compass)) : [];
  const seen = new Set(fits.map((it) => it.line.line_id));
  const best = new Map();
  for (const it of all) {
    const id = it.line.line_id;
    if (seen.has(id)) continue;
    const cur = best.get(id);
    if (!cur || it.failed.length < cur.failed.length || (it.failed.length === cur.failed.length && it.score > cur.score)) best.set(id, it);
  }
  const out = [...best.values()].sort((a, b) => b.score - a.score);
  return [
    ...fits.map((it) => ({ it, pct: it.fit, out: null })),
    ...out.map((it) => ({ it, pct: it.fit, out: [...new Set(it.failed.map((f) => reason(f, state)))].join(' · ') })),
  ];
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

function diffView(entries, compass, state) {
  const [a, b] = entries;
  const marks = (k) => [{ cls: 'you', at: compass[k], name: 'You' },
    ...entries.map((e, i) => ({ cls: i ? 'other' : 'top', at: e.it.ax[k], name: e.it.line.name, short: b ? e.it.line.name : 'This line' }))];
  return html`<div class="axis-bars">
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

// items: the filtered results; all: engine.lineFits(state); compare: line ids ticked (at most two); open: line ids
// whose rows are expanded.
export function lineList({ items, all, state, typeLabel, compare, open }) {
  const { compass } = state;
  const entries = lineEntries(items, all, compass, state);
  const picked = compare.map((id) => entries.find((e) => e.it.line.line_id === id)).filter(Boolean);
  const full = picked.length >= MAX_COMPARE;
  return html`<section class="lines" aria-labelledby="lines-h">
    <h2 class="quiz-title" id="lines-h">Every cruise line</h2>
    <p class="hint">Your match with each line's best-fitting ship. Open a line to see where you differ, or tick two to compare them.</p>
    ${comparePanel(picked, compass, state)}
    <ol class="line-list">${entries.map((e) => {
      const id = e.it.line.line_id;
      const on = compare.includes(id);
      return html`<li class="line-row${e.out ? ' out' : ''}">
        <label class="cmp"><input type="checkbox" data-cmp="${id}" ${on ? html`checked` : ''} ${full && !on ? html`disabled` : ''}><span class="sr-only">Compare ${e.it.line.name}</span></label>
        <details data-line="${id}" ${open.has(id) ? html`open` : ''}>
          <summary>
            <span class="ln">${e.it.line.name}</span>
            <span class="pct">${e.pct ?? '—'}%</span>
            <span class="meter" aria-hidden="true"><i style="width:${e.pct ?? 0}%"></i></span>
            <span class="sub">${e.out ? `Ruled out: ${e.out}` : `${typeLabel(id)} · best: ${e.it.ship.name}`}</span>
          </summary>
          ${diffView([e], compass, state)}
        </details>
      </li>`;
    })}</ol>
  </section>`;
}
