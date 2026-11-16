// Cruise compass (D59): seven two-ended axes. Every cabin gets a position from 0 (left end) to 100 (right end)
// on each axis: its percentile among all cabins, so positions stay put when filters change. The visitor says
// where they want to be; a cabin's fit is 100 minus its average distance from them on the axes they set.
// Amended by D64: a cabin with no data on an axis is never closer than UNKNOWN_GAP (unknown is not a match), and
// on "more is fine" axes, going past a visitor who leans that way costs nothing.

const TIER_LEVEL = { interior: 0, oceanview: 0.15, balcony: 0.3, perk_class: 0.5, junior_suite: 0.6, suite: 0.8, top_suite: 1 };
const DRINKS = { none: 0, soft: 0.5, alcohol: 1 };
const DINING = { main_only: 0, some_specialty: 0.5, all: 1 };
const ACTION = ['water_slides', 'sports_court', 'mini_golf', 'pickleball', 'splash_area'];
const VIP = ['butler', 'concierge', 'private_restaurant', 'private_lounge', 'priority_boarding'];
const SHIP_WIDE = new Set(['private_restaurant', 'private_lounge', 'priority_boarding']);

const mean = (xs) => {
  const known = xs.filter((x) => x != null);
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
};
const yes = (v) => (v == null ? null : v ? 1 : 0);
const no = (v) => (v == null ? null : v ? 0 : 1);
const tips = (g) => (g == null ? null : g === 0 ? 1 : 0);
// Share of yes answers, pulled toward neutral (0.5) by two imaginary answers, so a ship with one known feature
// can't score 0 or 100 on its own; ships with all five known barely move. Null when nothing is known.
const shrunk = (xs) => {
  const known = xs.filter((x) => x != null);
  return known.length ? (known.reduce((a, b) => a + b, 0) + 1) / (known.length + 2) : null;
};

// [key, left end, right end, raw value]. Unknown inputs are skipped, never counted as "no".
export const AXES = [
  ['budget', 'Budget', 'Splurge', (it) => it.priced.all_in],
  ['inclusive', 'Pay as you go', 'All-inclusive',
    ({ row }) => mean([tips(row.gratuity_pppd), DRINKS[row.drinks_included] ?? null, yes(row.wifi_included), DINING[row.included_dining] ?? null])],
  ['size', 'Intimate ship', 'Mega-ship', ({ ship }) => ship.gt],
  // Evidence only (D64): kids' clubs, slides and splash areas, plus an 18+ minimum age counted twice. A blank
  // minimum age is unknown, not "kids welcome", and a line that allows kids says nothing either way.
  ['adults', 'Family-friendly', 'Adults-only', ({ ship, line }) => {
    const adult = line.min_age != null && line.min_age >= 18 ? 1 : null;
    return shrunk([adult, adult, no(ship.kids_club), no(ship.teen_club), no(ship.water_slides), no(ship.splash_area)]);
  }],
  ['action', 'Relaxed', 'Action-packed', ({ ship }) => shrunk(ACTION.map((k) => yes(ship[k])))],
  ['newness', 'Classic', 'Brand-new', ({ ship }) => ship.newest_year],
  // On an all-suite luxury line every venue is open to every guest, so no suites-only lounge, restaurant or boarding
  // lane is "not applicable", not a missing perk (D74). Butler and concierge still count.
  ['suite', 'Standard cabin', 'Suite life', ({ row, line }) => mean([TIER_LEVEL[row.tier_type] ?? null,
    mean(VIP.map((k) => (line.segment === 'luxury' && row[k] === false && SHIP_WIDE.has(k) ? null : yes(row[k]))))])],
];

// Percentile position (0-100) of each item on each axis, among all items; ties share the midpoint.
export function placeOnAxes(items) {
  for (const it of items) it.ax = {};
  for (const [key, , , value] of AXES) {
    const vals = items.map((it) => [it, value(it)]).filter(([, v]) => v != null);
    const sorted = vals.map(([, v]) => v).sort((a, b) => a - b);
    const n = sorted.length;
    for (const [it, v] of vals) {
      const lo = sorted.findIndex((x) => x >= v);
      let hi = lo;
      while (hi < n && sorted[hi] === v) hi++;
      it.ax[key] = n === 1 ? 50 : Math.round(((lo + (hi - lo - 1) / 2) / (n - 1)) * 100);
    }
    for (const it of items) if (!(key in it.ax)) it.ax[key] = null;
  }
}

const UNKNOWN_GAP = 25;
// Axes where more is never worse for anyone leaning that way at all: more included, or a newer ship.
const MORE_IS_FINE = new Set(['inclusive', 'newness']);
// A strong lean (this far from the middle) means "at least this much": going further the same way costs nothing,
// e.g. cheaper for a budget traveller, smaller for someone who wants the ports, adults-only for "a grown-up feel".
const STRONG = 25;

// Distance between the visitor and a cabin on one axis (0-100).
export function gap(k, want, at) {
  if (at == null) return Math.max(Math.abs(want - 50), UNKNOWN_GAP);
  const lean = Math.sign(want - 50);
  const beyond = Math.sign(at - want) === lean;
  if (beyond && (Math.abs(want - 50) >= STRONG || (MORE_IS_FINE.has(k) && lean > 0))) return 0;
  return Math.abs(want - at);
}

// Axes measured per ship (every cabin on a ship sits at the same place on them).
const SHIP_AXES = ['size', 'adults', 'action', 'newness'];

// Cabin-level axes where leaning up means "more is better" for a tie: pricier, more suite, more included.
const UP_AXES = ['budget', 'suite', 'inclusive'];
const GROWN_UP = 70;

// How far past the visitor something sits in the direction they lean, averaged over the given axes they set.
function beyond(compass, ax, axes, upOnly = false) {
  const keys = axes.filter((k) => compass[k] != null && (upOnly ? compass[k] > 50 : compass[k] !== 50));
  if (!keys.length) return 0;
  return mean(keys.map((k) => (ax[k] == null ? 0 : Math.max(0, (ax[k] - compass[k]) * Math.sign(compass[k] - 50)))));
}

// Tie-break keys (D73, D74), both the same for every cabin of a ship so ties between a ship's own cabins still go to
// the cheaper one (D48): how far the ship goes past the visitor on the ship-level axes, then how far its best cabin
// goes past an upward lean on price, suite or inclusions ("I want the best").
function setLeans(items, compass) {
  const up = new Map();
  for (const it of items) {
    it.lean = beyond(compass, it.ax, SHIP_AXES);
    up.set(it.ship, Math.max(up.get(it.ship) ?? 0, beyond(compass, it.ax, UP_AXES, true)));
  }
  for (const it of items) it.leanUp = up.get(it.ship);
}

// Wi-Fi preference (D74): its own term in the fit, beside the axes. Unknown is never a match (D64).
const wifiGap = (row) => (row.wifi_included === true ? 0 : row.wifi_included === false ? 35 : UNKNOWN_GAP);

// Replace the weighted score with compass fit when the visitor has set at least one axis or the Wi-Fi preference.
export function applyCompass(items, compass, { wifiPref = false } = {}) {
  const keys = AXES.map(([k]) => k).filter((k) => compass[k] != null);
  if (!keys.length && !wifiPref) return false;
  setLeans(items, compass);
  // A visitor who leans grown-up (70+) has said it plainly, so that gap counts twice and size and action alone can't
  // outvote it (D75, amends D59's equal axes).
  const counted = compass.adults >= GROWN_UP ? [...keys, 'adults'] : keys;
  for (const it of items) {
    // Rank on the exact fit and show it rounded, so rounding doesn't make ties that the cheaper cabin then wins.
    it.score = 100 - mean([...counted.map((k) => gap(k, compass[k], it.ax[k])), ...(wifiPref ? [wifiGap(it.row)] : [])]);
    it.fit = Math.round(it.score);
    it.used = keys.filter((k) => it.ax[k] != null).length;
    it.of = keys.length;
  }
  return true;
}
