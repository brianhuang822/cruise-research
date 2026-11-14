// Shared state for all three modes, plus URL encoding so any view can be linked.

export const MODES = ['simple', 'detailed', 'wizard'];

export const TIER_TYPES = [
  ['interior', 'Interior'], ['oceanview', 'Ocean view'], ['balcony', 'Balcony'], ['junior_suite', 'Junior suite'],
  ['perk_class', 'Perk class'], ['suite', 'Suite'], ['top_suite', 'Top suite'],
];
export const SEGMENTS = [['mainstream', 'Mainstream'], ['premium', 'Premium'], ['luxury', 'Luxury']];
export const PERKS = [
  ['laundry', 'Free laundry (any)'], ['laundry_unlimited', 'Unlimited laundry'], ['butler', 'Butler'],
  ['concierge', 'Concierge'], ['private_lounge', 'Private lounge'], ['private_sundeck_pool', 'Private sundeck / pool'],
  ['priority_boarding', 'Priority boarding'],
];
export const AMENITIES = [
  ['pickleball', 'Pickleball'], ['sports_court', 'Sports / basketball court'], ['running_track', 'Running track'],
  ['self_laundry', 'Self-service laundry'], ['thermal_suite', 'Thermal suite'], ['adults_only_pool', 'Adults-only pool'],
  ['kids_club', 'Kids club'],
];
export const METRICS = [
  ['price', 'All-in price (lower is better)', 3],
  ['gt', 'Ship size (GT)', 1],
  ['newness', 'Newest build or refit', 1],
  ['space', 'Space ratio (GT ÷ guests)', 1],
  ['sqft', 'Cabin size', 1],
  ['dining', 'Specialty restaurants', 1],
  ['cdc', 'CDC sanitation score', 1],
];
export const DINING_RANK = { main_only: 0, some_specialty: 1, all: 2 };

export const DEFAULTS = Object.freeze({
  nights: 7, tickers: [], drinks: 'none', wifi: false, dinners: 0,
  segments: [], lines: [], types: [], maxPrice: null, minGt: 0, dining: 'any', privRest: false,
  grat: false, adults: false, perks: [], amen: [], unknowns: 'include', sort: 'score',
  w: Object.freeze(Object.fromEntries(METRICS.map(([k, , d]) => [k, d]))),
});

export const fresh = () => structuredClone({ ...DEFAULTS, w: { ...DEFAULTS.w } });

// One mutable store; views call store.set(...) and every subscriber re-renders.
export const store = {
  state: fresh(),
  mode: 'simple',
  listeners: new Set(),
  set(patch) {
    Object.assign(this.state, patch);
    this.emit();
  },
  replace(next) {
    this.state = next;
    this.emit();
  },
  setMode(mode) {
    this.mode = MODES.includes(mode) ? mode : 'simple';
    this.emit();
  },
  emit() {
    writeUrl();
    this.listeners.forEach((fn) => fn());
  },
};

const LIST_KEYS = ['tickers', 'segments', 'lines', 'types', 'perks', 'amen'];
const STRING_KEYS = ['drinks', 'dining', 'unknowns', 'sort'];
const NUMBER_KEYS = ['nights', 'dinners', 'minGt'];
const BOOL_KEYS = ['wifi', 'privRest', 'grat', 'adults'];

export function readUrl() {
  let q;
  try { q = new URLSearchParams(location.search); } catch { return; }
  const s = fresh();
  for (const k of LIST_KEYS) if (q.has(k)) s[k] = q.get(k).split(',').filter(Boolean);
  for (const k of STRING_KEYS) if (q.has(k)) s[k] = q.get(k);
  for (const k of NUMBER_KEYS) if (q.has(k)) s[k] = Number(q.get(k)) || 0;
  for (const k of BOOL_KEYS) if (q.has(k)) s[k] = q.get(k) === '1';
  if (q.has('maxPrice')) s.maxPrice = Number(q.get('maxPrice')) || null;
  if (q.has('w')) {
    const vals = q.get('w').split(',').map(Number);
    METRICS.forEach(([k], i) => { if (Number.isFinite(vals[i])) s.w[k] = Math.max(0, Math.min(5, vals[i])); });
  }
  store.state = s;
  store.mode = MODES.includes(q.get('mode')) ? q.get('mode') : 'simple';
}

export function urlFor(state, mode) {
  const q = new URLSearchParams();
  if (mode !== 'simple') q.set('mode', mode);
  for (const [k, v] of Object.entries(state)) {
    const d = DEFAULTS[k];
    if (k === 'w') {
      const enc = METRICS.map(([m]) => state.w[m]).join(',');
      if (enc !== METRICS.map(([m]) => d[m]).join(',')) q.set('w', enc);
    } else if (Array.isArray(v)) {
      if (v.length) q.set(k, v.join(','));
    } else if (v !== d && v != null) {
      q.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    }
  }
  const qs = q.toString();
  return location.pathname + (qs ? '?' + qs : '');
}

function writeUrl() {
  try { history.replaceState(null, '', urlFor(store.state, store.mode)); } catch { /* sandboxed preview frames */ }
}

export function toggleIn(list, value, on) {
  return on ? [...new Set([...list, value])] : list.filter((x) => x !== value);
}
