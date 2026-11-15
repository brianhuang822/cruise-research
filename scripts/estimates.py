"""Fare estimates per line and cabin type (D57), used until real fares from the price export arrive.

data/curated/fare_estimates.csv has one row per line, of two kinds:
- tracker: average per-night fares for inside, ocean view, balcony and suite from a third-party tracker;
- lead_in: a typical per-night "from" fare for one cabin type, from line pages or trade press.

The cabin ladder (what an ocean view, balcony or suite costs relative to an inside cabin) is the median across
tracker lines. Perk-class, junior-suite and top-suite steps are fixed assumptions, stated below.
"""

import math
from statistics import median

BASE = ("interior", "oceanview", "balcony", "suite")
PERK_OVER_BALCONY = 1.25  # assumption: perk classes (AquaClass, Havana, Concierge) about 25% over a balcony
TOP_OVER_SUITE = 2.0  # assumption: top suites about twice an entry suite


def _round5(x: float) -> int:
    return int(math.floor(x / 5 + 0.5) * 5)


def _complete(base: dict) -> dict:
    """Add the tier types between and above the four tracked cabin types."""
    out = dict(base)
    out["perk_class"] = base["balcony"] * PERK_OVER_BALCONY
    out["junior_suite"] = math.sqrt(base["balcony"] * base["suite"])  # halfway between, on a log scale
    out["top_suite"] = base["suite"] * TOP_OVER_SUITE
    return out


def ladder(rows: list[dict]) -> dict:
    ratios = {k: [r[k] / r["interior"] for r in rows if r["basis"] == "tracker" and r["interior"] and r[k]] for k in BASE[1:]}
    return _complete({"interior": 1.0, **{k: median(v) for k, v in ratios.items()}})


def check(rows: list[dict], line_ids: set, errors) -> None:
    for r in rows:
        if r["line_id"] not in line_ids:
            errors.add(r["_where"], f"unknown line_id {r['line_id']}")
        if r["basis"] == "tracker" and not all(r[k] for k in BASE[1:]):
            errors.add(r["_where"], "tracker rows need oceanview, balcony and suite")
        if r["basis"] == "lead_in" and not (r["lead_in_pppn"] and r["lead_in_tier_type"]):
            errors.add(r["_where"], "lead_in rows need lead_in_pppn and lead_in_tier_type")


def estimates(rows: list[dict]) -> tuple[dict, dict]:
    """Return ({(line_id, tier_type): fare}, ladder)."""
    if not any(r["basis"] == "tracker" and r["interior"] for r in rows):
        return {}, {}
    lad = ladder(rows)
    out = {}
    for r in rows:
        if r["basis"] == "tracker":
            base = {k: r[k] for k in BASE}
            if base["interior"] is None:
                base["interior"] = base["oceanview"] / lad["oceanview"]
            run = 0.0
            for k in BASE:  # a higher cabin type never costs less: running maximum up the ladder
                run = max(run, base[k])
                base[k] = run
            vals = _complete(base)
        else:
            unit = r["lead_in_pppn"] / lad[r["lead_in_tier_type"]]
            vals = {k: unit * f for k, f in lad.items()}
        out |= {(r["line_id"], k): _round5(v) for k, v in vals.items()}
    return out, {k: round(v, 3) for k, v in lad.items()}
