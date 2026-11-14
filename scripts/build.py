#!/usr/bin/env python3
"""Deterministic build: curated CSVs + snapshots -> data/dataset.json, data/dataset.csv, docs/data.json.

    python3 scripts/build.py           # validate + write outputs + print report
    python3 scripts/build.py --check   # exit 1 if committed outputs differ from a fresh build

Same inputs always produce byte-identical outputs (sorted keys, stable row order,
no wall-clock timestamps: last_updated = newest date found in the inputs).
"""

import re
import sys

from curated import ROOT, Errors, load_snapshot, load_table, parse_value
from render import render
from schema import AMENITY_COLUMNS, OVERRIDABLE_TIER_FIELDS, TABLES

SCHEMA_VERSION = 1
TIER_ROW_FIELDS = [k for k in TABLES["tiers"]["columns"] if k not in ("ships", "source_urls", "last_verified", "notes")]
COVERAGE_ROW_FIELDS = [
    "gratuity_pppd", "drinks_included", "wifi_included", "specialty_meals_included", "included_dining",
    "private_restaurant", "private_lounge", "private_sundeck_pool", "laundry_perk", "butler", "concierge",
    "priority_boarding", "thermal_suite_included", "sqft_min", "max_guests", "fare_pppn_median",
]  # fmt: skip
COVERAGE_SHIP_FIELDS = [*AMENITY_COLUMNS, "cdc_score", "last_refit"]


def by_key(rows, key):
    return {r[key]: r for r in rows}


# ---------------------------------------------------------------- integrity checks


def check_references(t, errors, warnings):
    lines, classes, ships = by_key(t["lines"], "line_id"), by_key(t["ship_classes"], "class_id"), by_key(t["ships"], "ship_id")
    tiers, bundles = by_key(t["tiers"], "tier_id"), by_key(t["bundles"], "bundle_id")

    for r in [*t["ship_classes"], *t["ships"], *t["tiers"], *t["bundles"]]:
        if r["line_id"] not in lines:
            errors.add(r["_where"], f"unknown line_id {r['line_id']}")
    for s in ships.values():
        cls = classes.get(s["class_id"])
        if not cls:
            errors.add(s["_where"], f"unknown class_id {s['class_id']}")
        elif cls["line_id"] != s["line_id"]:
            errors.add(s["_where"], "class belongs to another line")
    for tr in tiers.values():
        for sid in tr["ships"] if isinstance(tr["ships"], list) else []:
            if sid not in ships or ships[sid]["line_id"] != tr["line_id"]:
                errors.add(tr["_where"], f"ships: {sid} not a ship of {tr['line_id']}")
        if tr["sqft_min"] and tr["sqft_max"] and tr["sqft_min"] > tr["sqft_max"]:
            errors.add(tr["_where"], "sqft_min > sqft_max")
        if tr["included_dining"] == "all" and tr["specialty_meals_included"] not in ("unlimited", None):
            warnings.append(f"{tr['_where']}: included_dining=all but specialty_meals_included={tr['specialty_meals_included']}")
    for b in bundles.values():
        for tid in [] if b["applies_to_tiers"] == "all" else b["applies_to_tiers"].split(";"):
            if tid not in tiers or tiers[tid]["line_id"] != b["line_id"]:
                errors.add(b["_where"], f"applies_to_tiers: {tid} not a tier of {b['line_id']}")
    for sb in t["shareholder_benefits"]:
        if sb["min_nights"] and sb["max_nights"] and sb["min_nights"] > sb["max_nights"]:
            errors.add(sb["_where"], "min_nights > max_nights")
    with_benefit = {sb["ticker"] for sb in t["shareholder_benefits"]}
    for ln in lines.values():
        if ln["shareholder_benefit"] == "yes" and ln["ticker"] not in with_benefit:
            errors.add(ln["_where"], f"benefit=yes but no shareholder_benefits rows for {ln['ticker']}")


def check_import_tables(t, errors):
    tiers, ships = by_key(t["tiers"], "tier_id"), by_key(t["ships"], "ship_id")
    for r in t["category_map"]:
        if r["tier_id"] not in tiers or tiers[r["tier_id"]]["line_id"] != r["line_id"]:
            errors.add(r["_where"], f"{r['tier_id']} is not a tier of {r['line_id']}")
        try:
            re.compile(r["pattern"])
        except re.error as e:
            errors.add(r["_where"], f"bad regex: {e}")
    for d in t["ship_deployments"]:
        if d["ship_id"] not in ships:
            errors.add(d["_where"], f"unknown ship_id {d['ship_id']}")


def add_deployment(rec, dep):
    for field in ("regions", "homeports", "months"):
        value = dep.get(field)
        rec[field] = value.split(";") if value else None
    rec["deployment_as_of"] = dep.get("as_of")
    return rec


def collect_overrides(t, errors):
    tiers, ships = by_key(t["tiers"], "tier_id"), by_key(t["ships"], "ship_id")
    overrides: dict[tuple, dict] = {}
    for o in t["tier_overrides"]:
        problem = (
            f"unknown tier_id {o['tier_id']}" if o["tier_id"] not in tiers
            else f"unknown ship_id {o['ship_id']}" if o["ship_id"] not in ships
            else f"field {o['field']!r} not overridable" if o["field"] not in OVERRIDABLE_TIER_FIELDS
            else None
        )  # fmt: skip
        if problem:
            errors.add(o["_where"], problem)
            continue
        typ = OVERRIDABLE_TIER_FIELDS[o["field"]][0]
        val = parse_value(o["value"] or "", typ, f"{o['_where']} [value]", errors)
        overrides.setdefault((o["tier_id"], o["ship_id"]), {})[o["field"]] = (val, o)
    return overrides


def collect_prices(t, errors):
    ships, tiers, bundles = by_key(t["ships"], "ship_id"), by_key(t["tiers"], "tier_id"), by_key(t["bundles"], "bundle_id")
    prices = {}
    for p in t["prices"]:
        if p["ship_id"] not in ships or p["tier_id"] not in tiers:
            errors.add(p["_where"], "unknown ship_id/tier_id")
            continue
        if p["fare_basis"] != "cruise_only" and p["fare_basis"] not in bundles:
            errors.add(p["_where"], f"fare_basis {p['fare_basis']!r} is not cruise_only or a bundle_id")
        prices[(p["ship_id"], p["tier_id"])] = p
    return prices


# ---------------------------------------------------------------- resolution


class Sources:
    """Deterministic source ids: every URL sorted, numbered s1..sN."""

    def __init__(self, t, extra):
        urls = {u for rows in t.values() for r in rows for u in (r.get("source_urls") or [])} | set(extra)
        self.ids = {u: f"s{i + 1}" for i, u in enumerate(sorted(urls))}

    def of(self, *rows):
        found = {self.ids[u] for r in rows for u in ((r or {}).get("source_urls") or [])}
        return sorted(found, key=lambda s: int(s[1:]))

    def table(self):
        return {v: k for k, v in sorted(self.ids.items(), key=lambda kv: int(kv[1][1:]))}


def wikidata_warnings(ship, wd):
    w = wd["ships"].get(ship["wikidata_qid"])
    if not w:
        return [f"{ship['ship_id']}: wikidata {ship['wikidata_qid']} not in snapshot (re-run fetch_wikidata.py)"]
    out = []
    gts = [float(x) for x in w.get("gt", [])]
    if gts and not any(abs(g - ship["gt"]) / ship["gt"] <= 0.02 for g in gts):
        out.append(f"{ship['ship_id']}: gt {ship['gt']} vs wikidata {w['gt']}")
    years = [int(x) for x in w.get("service_entry", [])]
    if years and ship["year_built"] not in years:
        out.append(f"{ship['ship_id']}: year_built {ship['year_built']} vs wikidata {w['service_entry']}")
    return out


def resolve_ship(s, cls, cdc, src):
    rec = {
        k: s[k]
        for k in (
            "ship_id",
            "line_id",
            "class_id",
            "name",
            "official_url",
            "year_built",
            "last_refit",
            "gt",
            "pax_double",
            "wikidata_qid",
        )
    }
    rec["class_name"] = cls.get("name")
    rec["amenity_level"] = {}
    for col in AMENITY_COLUMNS:
        from_ship = s[col] is not None
        rec[col] = s[col] if from_ship else cls.get(col)
        rec["amenity_level"][col] = "ship" if from_ship else "class"
    rec["space_ratio"] = round(s["gt"] / s["pax_double"], 1)
    rec["newest_year"] = max(s["year_built"], s["last_refit"] or s["year_built"])
    by_name = {r["ship_name"].lower(): r for r in (cdc or {}).get("records", [])}
    hit = by_name.get((s["cdc_name"] or s["name"]).lower())
    rec["cdc_score"] = hit["cdc_score"] if hit else None
    rec["cdc_date"] = hit["cdc_date"] if hit else None
    rec["sources"] = src.of(s, cls, {"source_urls": [cdc["source"]]} if hit else None)
    rec["last_verified"] = max(filter(None, [s["last_verified"], cls.get("last_verified")]))
    return rec


def resolve_rows(t, overrides, prices, src, ship_names):
    tiers, ships = by_key(t["tiers"], "tier_id"), by_key(t["ships"], "ship_id")
    rows = []
    for tr in tiers.values():
        ship_ids = [s for s in ships if ships[s]["line_id"] == tr["line_id"]] if tr["ships"] == "all" else tr["ships"]
        for sid in ship_ids:
            row = {k: tr[k] for k in TIER_ROW_FIELDS}
            row.update(row_id=f"{sid}__{tr['tier_id']}", ship_id=sid)
            ov = overrides.get((tr["tier_id"], sid), {})
            used = [orow for _, orow in ov.values()]
            row.update({field: val for field, (val, _) in ov.items()})
            row["overridden"] = sorted(ov)
            p = prices.get((sid, tr["tier_id"])) or {}
            row.update(
                fare_pppn_median=p.get("fare_pppn_median"), fare_n_sailings=p.get("n_sailings"),
                fare_basis=p.get("fare_basis"), fare_as_of=p.get("as_of"), fare_source=p.get("source"),
            )  # fmt: skip
            row["sources"] = src.of(tr, *used)
            row["last_verified"] = max([tr["last_verified"]] + [o["last_verified"] for o in used])
            rows.append(row)
    rows.sort(key=lambda r: (r["line_id"], ship_names[r["ship_id"]], r["rank"], r["tier_id"]))
    return rows


def coverage_report(lines, rows, ships):
    def pct(items, field):
        return round(100 * sum(i[field] is not None for i in items) / len(items)) if items else 0

    report = {}
    for lid in sorted(lines):
        lrows = [r for r in rows if r["line_id"] == lid]
        lships = [s for s in ships if s["line_id"] == lid]
        known = {f: pct(lrows, f) for f in COVERAGE_ROW_FIELDS} | {f: pct(lships, f) for f in COVERAGE_SHIP_FIELDS}
        report[lid] = {"rows": len(lrows), "ships": len(lships), "pct_known": known}
    return report


def build():
    errors, warnings = Errors(), []
    t = {name: load_table(name, errors) for name in TABLES}
    check_references(t, errors, warnings)
    check_import_tables(t, errors)
    overrides = collect_overrides(t, errors)
    prices = collect_prices(t, errors)
    cdc, wd = load_snapshot("cdc_vsp"), load_snapshot("wikidata_ships")
    src = Sources(t, [cdc["source"]] if cdc else [])
    lines, classes = by_key(t["lines"], "line_id"), by_key(t["ship_classes"], "class_id")
    if errors:
        return None, errors, warnings

    ships = sorted(t["ships"], key=lambda s: (s["line_id"], s["name"]))
    deployments = by_key(t["ship_deployments"], "ship_id")
    out_ships = [
        add_deployment(resolve_ship(s, classes.get(s["class_id"], {}), cdc, src), deployments.get(s["ship_id"], {}))
        for s in ships
    ]
    if wd:
        warnings += [w for s in ships if s["wikidata_qid"] for w in wikidata_warnings(s, wd)]
    out_rows = resolve_rows(t, overrides, prices, src, {s["ship_id"]: s["name"] for s in ships})

    def public(r):
        d = {k: v for k, v in r.items() if not k.startswith("_") and k != "source_urls"}
        if "source_urls" in r:
            d["sources"] = src.of(r)
        return d

    dates = [r["last_verified"] for rows in t.values() for r in rows if r.get("last_verified")]
    dates += [p["as_of"] for p in t["prices"]] + [s["fetched_on"] for s in (cdc, wd) if s]
    tiers_sorted = sorted(t["tiers"], key=lambda r: (r["line_id"], r["rank"]))
    dataset = {
        "schema_version": SCHEMA_VERSION,
        "last_updated": max(dates) if dates else None,
        "snapshots": {"cdc_vsp": cdc["fetched_on"] if cdc else None, "wikidata": wd["fetched_on"] if wd else None},
        "lines": [public(lines[k]) for k in sorted(lines)],
        "shareholder_benefits": sorted(map(public, t["shareholder_benefits"]), key=lambda r: (r["ticker"], r["min_nights"])),
        "bundles": sorted(map(public, t["bundles"]), key=lambda r: r["bundle_id"]),
        "tiers": [public(r) for r in tiers_sorted],
        "ships": out_ships,
        "rows": out_rows,
        "sources": src.table(),
        "coverage": coverage_report(lines, out_rows, out_ships),
        "warnings": sorted(warnings),
    }
    return dataset, errors, warnings


def report(dataset, warnings):
    print(
        f"Built {len(dataset['rows'])} rows · {len(dataset['ships'])} ships · {len(dataset['tiers'])} tiers · "
        f"{len(dataset['lines'])} lines · last_updated {dataset['last_updated']}"
    )
    for lid, c in dataset["coverage"].items():
        gaps = ", ".join(f"{k} {v}%" for k, v in c["pct_known"].items() if v < 100) or "none"
        print(f"  {lid}: {c['ships']} ships, {c['rows']} rows; fields <100% known: {gaps}")
    for w in warnings:
        print("  warning: " + w)


def main(argv):
    dataset, errors, warnings = build()
    if errors:
        print(f"{len(errors)} validation error(s):", file=sys.stderr)
        for e in errors:
            print("  " + e, file=sys.stderr)
        return 1
    outputs = render(dataset)
    if "--check" in argv:
        stale = [p for p, text in outputs.items() if not p.exists() or p.read_text(encoding="utf-8") != text]
        if stale:
            names = ", ".join(str(p.relative_to(ROOT)) for p in stale)
            print(f"Out of date: {names}\nRun: python3 scripts/build.py", file=sys.stderr)
            return 1
        print("Outputs are up to date.")
        return 0
    for p, text in outputs.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    report(dataset, warnings)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
