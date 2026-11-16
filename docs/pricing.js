// All-in price engine (per person, per night, 2 guests per cabin).
// Mirrored by scripts/pricing.py; tests/test_pricing_parity.py checks they agree.
// Spec: roadmap.md §5.

export const DRINK_LEVEL = { none: 0, soft: 1, alcohol: 2 };
export const GUESTS = 2;

const r2 = (x) => Math.round(x * 100) / 100;

function mealsCovered(a, b) {
  // combine two "included meals" values (int | 'unlimited' | null)
  if (a === 'unlimited' || b === 'unlimited') return 'unlimited';
  if (a == null && b == null) return null;
  return (a || 0) + (b || 0);
}

function maxDrinks(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  return DRINK_LEVEL[a] >= DRINK_LEVEL[b] ? a : b;
}

// A line's published price for a paid extra, else the typical price across lines that publish one (D64).
// Returns [price, estimated] or [null, false].
function extraPrice(line, key) {
  if (line[key] != null) return [line[key], false];
  const est = line[`${key}_est`];
  return est == null ? [null, false] : [est, true];
}

// Cost of the user's wants given what is covered. Returns {total, parts, missing, est}.
function extrasCost(inputs, cover, line) {
  const parts = {};
  const missing = [];
  const est = [];

  // gratuities
  if (cover.gratuities) parts.gratuity = 0;
  else if (cover.gratuity_pppd == null) missing.push('gratuity');
  else parts.gratuity = cover.gratuity_pppd;

  // drinks
  const want = inputs.drinks || 'none';
  if (want === 'none') parts.drinks = 0;
  else if (cover.drinks == null) missing.push('drinks_included');
  else if (DRINK_LEVEL[cover.drinks] >= DRINK_LEVEL[want]) parts.drinks = 0;
  else {
    const key = want === 'alcohol' ? 'drink_pkg_pppd' : 'soft_pkg_pppd';
    const [p, guessed] = extraPrice(line, key);
    if (p == null) missing.push(key);
    else parts.drinks = p;
    if (guessed) est.push('drinks');
  }

  // wifi
  if (!inputs.wifi) parts.wifi = 0;
  else if (cover.wifi == null) missing.push('wifi_included');
  else if (cover.wifi) parts.wifi = 0;
  else {
    const [p, guessed] = extraPrice(line, 'wifi_pppd');
    if (p == null) missing.push('wifi_pppd');
    else parts.wifi = p;
    if (guessed) est.push('wifi');
  }

  // specialty dinners (per cruise -> per night)
  const d = inputs.dinners || 0;
  if (d === 0) parts.specialty = 0;
  else if (cover.meals == null) missing.push('specialty_meals_included');
  else if (cover.meals === 'unlimited') parts.specialty = 0;
  else {
    const extra = Math.max(0, d - cover.meals);
    if (extra === 0) parts.specialty = 0;
    else if (line.specialty_meal_price == null) missing.push('specialty_meal_price');
    else parts.specialty = (extra * line.specialty_meal_price) / inputs.nights;
  }

  if (missing.length) return { total: null, parts, missing, est };
  const total = parts.gratuity + parts.drinks + parts.wifi + parts.specialty;
  return { total, parts, missing, est };
}

export function bundleApplies(bundle, tierId) {
  return bundle.applies_to_tiers === 'all' || bundle.applies_to_tiers.split(';').includes(tierId);
}

export function obcFor(line, inputs, benefits) {
  // returns {pppn, status, note}
  if (!line.ticker || !inputs.tickers || !inputs.tickers.includes(line.ticker)) {
    return { pppn: 0, status: 'none', note: null };
  }
  if (line.shareholder_benefit === 'unknown') return { pppn: 0, status: 'unknown', note: 'Shareholder credit not confirmed for this line' };
  if (line.shareholder_benefit !== 'yes') return { pppn: 0, status: 'none', note: null };
  const tier = benefits.find((b) => b.ticker === line.ticker && inputs.nights >= b.min_nights && inputs.nights <= b.max_nights);
  if (!tier) return { pppn: 0, status: 'none', note: null };
  const note = tier.valid_through ? `Confirmed for sailings through ${tier.valid_through}. Expected after that, but not confirmed.` : null;
  return {
    pppn: tier.obc_usd / GUESTS / inputs.nights,
    status: tier.valid_through ? 'expected_after_valid_through' : 'applied',
    note,
    obc_usd: tier.obc_usd,
  };
}

// row: resolved ship×tier row; line: line record; bundles: all bundles; benefits: shareholder table
export function allIn(row, line, bundles, benefits, inputs) {
  const baseCover = {
    gratuities: row.gratuity_pppd === 0,
    gratuity_pppd: row.gratuity_pppd,
    drinks: row.drinks_included,
    wifi: row.wifi_included,
    meals: row.specialty_meals_included,
  };
  let best = { method: 'a_la_carte', ...extrasCost(inputs, baseCover, line) };

  for (const b of bundles) {
    if (b.line_id !== row.line_id || b.price_pppd == null || !bundleApplies(b, row.tier_id)) continue;
    const cover = {
      gratuities: baseCover.gratuities || b.covers_gratuities === true,
      gratuity_pppd: baseCover.gratuity_pppd,
      drinks: maxDrinks(baseCover.drinks, b.covers_drinks),
      wifi: baseCover.wifi === true || b.covers_wifi === true ? true : baseCover.wifi,
      meals: mealsCovered(baseCover.meals, b.covers_specialty_meals),
    };
    const c = extrasCost(inputs, cover, line);
    if (c.total == null) continue;
    const total = c.total + b.price_pppd;
    // A fully published option beats one that leans on a typical price (D64); otherwise the cheaper wins.
    const guessed = c.est.length > 0;
    const bestGuessed = best.total != null && best.est.length > 0;
    if (best.total == null || (bestGuessed && !guessed) || (bestGuessed === guessed && total < best.total - 1e-9)) {
      best = { method: b.bundle_id, total, parts: { ...c.parts, bundle: b.price_pppd }, missing: [], est: c.est };
    }
  }

  const obc = obcFor(line, inputs, benefits);
  // Real median first; otherwise the line-and-cabin-type estimate (D57), flagged so the site can label it.
  const fare = row.fare_pppn_median ?? row.fare_est_pppn ?? null;
  const estimated = row.fare_pppn_median == null && fare != null;
  const extras = best.total;
  const all_in = fare != null && extras != null ? r2(fare + extras - obc.pppn) : null;
  const missing = [...best.missing];
  if (fare == null) missing.push('fare');
  return {
    fare,
    estimated,
    extras: extras == null ? null : r2(extras),
    method: best.method,
    extras_est: best.missing.length ? [] : best.est,
    parts: Object.fromEntries(Object.entries(best.parts).map(([k, v]) => [k, r2(v)])),
    obc: r2(obc.pppn),
    obc_status: obc.status,
    obc_note: obc.note,
    all_in,
    missing,
  };
}
