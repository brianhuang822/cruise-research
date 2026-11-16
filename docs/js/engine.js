// Filter, price and score every ship × tier row for a given state. Shared by all modes.
import { allIn } from '../pricing.js';
import { applyCompass, placeOnAxes } from './axes.js';
import { DINING_RANK, METRICS, PERKS } from './state.js';

const PERK_KEYS = new Set(PERKS.map(([k]) => k));

export function createEngine(data) {
  const LINES = Object.fromEntries(data.lines.map((l) => [l.line_id, l]));
  const SHIPS = Object.fromEntries(data.ships.map((s) => [s.ship_id, s]));
  const TIERS = Object.fromEntries(data.tiers.map((t) => [t.tier_id, t]));
  return { data, LINES, SHIPS, TIERS, compute: (state) => compute(data, LINES, SHIPS, state) };
}

const tri = (v) => (v == null ? null : !!v);
const known = (v, test) => (v == null ? null : test(v));

function perkCheck(row, p) {
  if (p === 'laundry') return known(row.laundry_perk, (v) => v !== 'none');
  if (p === 'laundry_unlimited') return known(row.laundry_perk, (v) => v === 'unlimited');
  return tri(row[p]);
}

function amenityCheck(row, ship, a) {
  if (a === 'self_laundry') return known(ship.self_laundry, (v) => v !== 'none');
  // Free thermal spa: included for every guest on the ship, or with this cabin tier (e.g. Celebrity AquaClass).
  if (a === 'thermal_free') return row.thermal_suite_included === true ? true : known(ship.thermal_suite, (v) => v === 'included');
  if (a === 'thermal_suite') return row.thermal_suite_included === true ? true : known(ship.thermal_suite, (v) => v !== 'none');
  return tri(ship[a]);
}

// Unknown extras can only add to the price, so when the known part alone is over the limit that is a known "no" (D64).
function withinBudget(priced, max) {
  if (priced.all_in != null) return priced.all_in <= max;
  if (priced.fare == null) return null;
  const floor = priced.fare + Object.values(priced.parts).reduce((a, b) => a + b, 0) - priced.obc;
  return floor > max ? false : null;
}

// Returns true, false, or 'unknown' (passes only because unknowns are kept).
export function evalFilters(state, row, line, ship, priced) {
  const checks = [];
  if (state.segments.length) checks.push(state.segments.includes(line.segment));
  if (state.lines.length) checks.push(state.lines.includes(row.line_id));
  if (state.types.length) checks.push(state.types.includes(row.tier_type));
  // Region (D58): any picked region; untagged ships are unknown, so they follow confirmed matches.
  if (state.regions.length) checks.push(known(ship.regions, (v) => v.some((r) => state.regions.includes(r))));
  if (state.maxPrice != null) checks.push(withinBudget(priced, state.maxPrice));
  if (state.minGt > 0) checks.push(ship.gt >= state.minGt);
  if (state.dining !== 'any') checks.push(known(row.included_dining, (v) => DINING_RANK[v] >= DINING_RANK[state.dining]));
  if (state.privRest) checks.push(tri(row.private_restaurant));
  if (state.grat) checks.push(known(row.gratuity_pppd, (v) => v === 0));
  if (state.wifiFree) checks.push(tri(row.wifi_included));
  if (state.adults) checks.push(known(line.min_age, (v) => v >= 18));
  if (state.guests > 2) checks.push(known(row.max_guests, (v) => v >= state.guests));
  for (const p of state.perks) checks.push(perkCheck(row, p));
  for (const a of state.amen) checks.push(amenityCheck(row, ship, a));
  if (checks.includes(false)) return false;
  if (checks.includes(null)) return state.unknowns === 'include' ? 'unknown' : false;
  return true;
}

// Nice to have (D55): how many of the picked perks and amenities this row is confirmed to have.
// Unknown counts as not confirmed, never as "no"; the row is still shown.
function niceCount(state, row, ship) {
  if (!state.nice.length) return null;
  return state.nice.filter((k) => (PERK_KEYS.has(k) ? perkCheck(row, k) : amenityCheck(row, ship, k)) === true).length;
}

function metricValue(key, row, ship, priced) {
  const values = {
    price: priced.all_in, gt: ship.gt, newness: ship.newest_year, space: ship.space_ratio,
    sqft: row.sqft_min, dining: ship.specialty_restaurants, cdc: ship.cdc_score,
  };
  return values[key] ?? null;
}

// Percentile rank (0–100) of each item's value among items that have one; ties share the midpoint.
function percentiles(items, key) {
  const vals = items.map((it) => it.m[key]).filter((v) => v != null).sort((a, b) => a - b);
  const n = vals.length;
  const out = new Map();
  for (const it of items) {
    const v = it.m[key];
    if (v == null) continue;
    if (n === 1) { out.set(it, 100); continue; }
    const lo = vals.findIndex((x) => x >= v);
    let hi = lo;
    while (hi < n && vals[hi] === v) hi++;
    const p = ((lo + (hi - lo - 1) / 2) / (n - 1)) * 100;
    out.set(it, key === 'price' ? 100 - p : p);
  }
  return out;
}

function score(items, weights, hasNice) {
  const active = METRICS.filter(([k]) => weights[k] > 0 && (k !== 'nice' || hasNice)).map(([k]) => k);
  const tables = Object.fromEntries(active.map((k) => [k, percentiles(items, k)]));
  for (const it of items) {
    let num = 0;
    let den = 0;
    it.parts = {};
    for (const k of active) {
      const p = tables[k].get(it);
      if (p == null) continue;
      num += weights[k] * p;
      den += weights[k];
      it.parts[k] = p;
    }
    it.score = den ? num / den : null;
    it.used = Object.keys(it.parts).length;
    it.of = active.length;
  }
}

const SORT_ASC = new Set(['price']);

// Ties go to the cheaper cabin: all-in price when both are known, else the line's tier order (rank 1 = cheapest).
// This also picks which cabin leads a ship's card when every cabin on the ship scores the same.
function tieBreak(a, b) {
  const pa = a.priced.all_in;
  const pb = b.priced.all_in;
  if (pa != null && pb != null && pa !== pb) return pa - pb;
  if (a.row.rank !== b.row.rank) return (a.row.rank ?? 99) - (b.row.rank ?? 99);
  return a.row.row_id < b.row.row_id ? -1 : 1;
}

export const PARTIAL_PENALTY = 12;

// Confirmed matches come first (D52) in every sort except Best match, where unconfirmed rows carry a score
// penalty instead (D65): a row that passes every filter on known data ranks above one that passes only because
// a filtered value is unknown.
export function sortItems(items, key) {
  const val = (it) => (key === 'score' ? it.score : it.m[key]);
  const asc = SORT_ASC.has(key);
  return items.sort((a, b) => {
    if (key !== 'score' && a.partial !== b.partial) return a.partial ? 1 : -1;
    const va = val(a);
    const vb = val(b);
    if (va == null || vb == null || va === vb) {
      if (va == null && vb != null) return 1;
      if (vb == null && va != null) return -1;
      return tieBreak(a, b);
    }
    return asc ? va - vb : vb - va;
  });
}

function compute(data, LINES, SHIPS, state) {
  const inputs = { nights: state.nights, tickers: state.tickers, drinks: state.drinks, wifi: state.wifi, dinners: state.dinners };
  // Price and place every cabin first, so compass positions don't depend on the filters.
  const all = data.rows.map((row) => {
    const line = LINES[row.line_id];
    return { row, line, ship: SHIPS[row.ship_id], priced: allIn(row, line, data.bundles, data.shareholder_benefits, inputs) };
  });
  placeOnAxes(all);
  const items = [];
  for (const it of all) {
    const pass = evalFilters(state, it.row, it.line, it.ship, it.priced);
    if (!pass) continue;
    it.partial = pass === 'unknown';
    it.m = Object.fromEntries(METRICS.map(([k]) => [k, k === 'nice' ? niceCount(state, it.row, it.ship) : metricValue(k, it.row, it.ship, it.priced)]));
    items.push(it);
  }
  score(items, state.w, state.nice.length > 0);
  applyCompass(items, state.compass);
  // Best match (D65, amends D52): a row that passes only because some data is missing loses points instead of
  // ranking below every confirmed row, so thinly researched ships can still win when they fit much better.
  for (const it of items) if (it.partial && it.score != null) it.score = Math.max(0, it.score - PARTIAL_PENALTY);
  return sortItems(items, state.sort);
}

// Line types for the quiz (D50): the curated segment, except that a non-luxury line whose cheapest cabin
// already includes specialty restaurants (Oceania, Viking, Virgin) is its own type.
export function lineTypes(data) {
  const cheapest = {};
  for (const t of data.tiers) {
    if (!cheapest[t.line_id] || t.rank < cheapest[t.line_id].rank) cheapest[t.line_id] = t;
  }
  const typeOf = (l) => (l.segment !== 'luxury' && cheapest[l.line_id]?.included_dining === 'all' ? 'specialty_included' : l.segment);
  const out = {};
  for (const l of data.lines) (out[typeOf(l)] ||= []).push(l.line_id);
  return out;
}

export function activeFilterCount(state) {
  const lists = state.segments.length + state.lines.length + state.types.length + state.regions.length + state.perks.length + state.amen.length + state.nice.length;
  const flags = [state.maxPrice != null, state.minGt > 0, state.dining !== 'any', state.privRest, state.grat, state.wifiFree, state.adults, state.guests > 2];
  return lists + flags.filter(Boolean).length;
}
