// Bootstrap: load the dataset, pick the mode from the URL, and re-render the active view on every change.
import { $, append, html, mount } from './js/dom.js';
import { createEngine } from './js/engine.js';
import { MODES, readUrl, store, urlFor } from './js/state.js';
import { detailHtml } from './js/views/common.js';
import { initDetailed, onDetailedShow, renderDetailed } from './js/views/detailed.js';
import { initSimple, onSimpleShow, renderSimple, syncWeights } from './js/views/simple.js';
import { initWizard, onWizardShow, renderWizard } from './js/views/wizard.js';

const VIEWS = {
  simple: { el: 'mode-simple', show: onSimpleShow, render: renderSimple },
  detailed: { el: 'mode-detailed', show: onDetailedShow, render: renderDetailed },
  wizard: { el: 'mode-wizard', show: onWizardShow, render: renderWizard },
};

let engine;
let items = [];
let shownMode = null;

function render() {
  const mode = store.mode;
  if (mode !== shownMode) {
    for (const m of MODES) {
      $(VIEWS[m].el).hidden = m !== mode;
      const tab = $(`tab-${m}`);
      tab.setAttribute('aria-selected', String(m === mode));
      tab.tabIndex = m === mode ? 0 : -1;
    }
    shownMode = mode;
    VIEWS[mode].show();
  }
  items = engine.compute(store.state);
  VIEWS[mode].render(items);
}

function goTo(mode) {
  store.setMode(mode);
  window.scrollTo({ top: 0 });
}

function bindShell() {
  $('mode-tabs').onclick = (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) goTo(tab.dataset.mode);
  };
  $('mode-tabs').onkeydown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = MODES.indexOf(store.mode);
    const next = MODES[(i + (e.key === 'ArrowRight' ? 1 : MODES.length - 1)) % MODES.length];
    goTo(next);
    $(`tab-${next}`).focus();
  };
  // Weight sliders in any mode: show the number while dragging, apply it on release.
  document.addEventListener('input', (e) => {
    const k = e.target.dataset?.weight;
    const out = k && e.target.parentElement.querySelector('output');
    if (out) out.textContent = e.target.value;
  });
  document.addEventListener('change', (e) => {
    const k = e.target.dataset?.weight;
    if (!k) return;
    store.set({ w: { ...store.state.w, [k]: Number(e.target.value) } });
    if (store.mode === 'simple') syncWeights();
  });
  // Fill a result's detail panel the first time it opens.
  document.addEventListener('toggle', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLDetailsElement) || !el.dataset.id || !el.open || el.querySelector('.detail')) return;
    const it = items.find((x) => x.row.row_id === el.dataset.id);
    if (it) append(el, detailHtml(it, engine, store.state.w));
  }, true);
  $('copy-link').onclick = async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(location.origin + urlFor(store.state, store.mode));
      btn.textContent = 'Link copied';
    } catch {
      btn.textContent = 'Copy the address bar';
    }
    setTimeout(() => { btn.textContent = 'Copy link'; }, 1800);
  };
}

async function main() {
  const data = await (await fetch('data.json')).json();
  engine = createEngine(data);
  readUrl();
  const n = data.lines.length;
  $('foot-updated').textContent = `Updated ${data.last_updated} · ${n} lines · ${data.ships.length} ships · ${data.rows.length.toLocaleString('en-US')} cabin options · CDC scores fetched ${data.snapshots.cdc_vsp ?? 'n/a'}`;
  initSimple(engine);
  initDetailed(engine, render);
  initWizard(goTo);
  bindShell();
  store.listeners.add(render);
  render();
}

main().catch((err) => {
  mount($('mode-wizard'), html`<p class="empty">Couldn't load the cabin data (${err.message}). Reload the page. If it still fails, data.json is missing from this deployment.</p>`);
  $('mode-wizard').hidden = false;
});
