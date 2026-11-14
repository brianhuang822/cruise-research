#!/usr/bin/env python3
"""Deterministic build: curated CSVs + snapshots -> data/dataset.json, data/dataset.csv, docs/data.json.

    python3 scripts/build.py           # validate + write outputs + print report
    python3 scripts/build.py --check   # exit 1 if committed outputs differ from a fresh build

Same inputs always produce byte-identical outputs (sorted keys, stable row order,
no wall-clock timestamps: last_updated = newest date found in the inputs).
"""
import csv
import io
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from schema import (  # noqa: E402
    AMENITY_COLUMNS, OVERRIDABLE_TIER_FIELDS, RANGES, REQUIRED, TABLES,
)

ROOT = Path(__file__).resolve().parent.parent
CURATED = ROOT / "data" / "curated"
SNAPSHOTS = ROOT / "data" / "snapshots"
OUT_JSON = ROOT / "data" / "dataset.json"
OUT_CSV = ROOT / "data" / "dataset.csv"
OUT_SITE = ROOT / "docs" / "data.json"
SCHEMA_VERSION = 1

SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
URL = re.compile(r"^https?://\S+$")


class Errors(list):
    def add(self, where, msg):
        self.append(f"{where}: {msg}")


# ---------------------------------------------------------------- parsing

def parse_value(raw: str, typ: str, where: str, errors: Errors):
    v = raw.strip()
    if v == "":
        return None
    try:
        if typ == "slug":
            if not SLUG.match(v):
                raise ValueError(f"bad slug {v!r}")
            return v
        if typ == "text":
            return v
        if typ == "url":
            if not URL.match(v):
                raise ValueError(f"bad url {v!r}")
            return v
        if typ == "urls":
            urls = [u.strip() for u in v.split(";") if u.strip()]
            for u in urls:
                if not URL.match(u):
                    raise ValueError(f"bad url {u!r}")
            return urls
        if typ == "date":
            if not DATE.match(v):
                raise ValueError(f"bad date {v!r}")
            return v
        if typ == "int":
            return int(v)
        if typ == "num":
            x = float(v)
            if x < 0:
                raise ValueError("negative amount")
            return int(x) if x.is_integer() else x
        if typ == "bool":
            if v not in ("0", "1"):
                raise ValueError(f"bool must be 0/1/blank, got {v!r}")
            return v == "1"
        if typ == "meals":
            return "unlimited" if v == "unlimited" else int(v)
        if typ == "ships":
            if v == "all":
                return "all"
            ids = [s.strip() for s in v.split(";") if s.strip()]
            for s in ids:
                if not SLUG.match(s):
                    raise ValueError(f"bad ship id {s!r}")
            return ids
        if typ.startswith("enum:"):
            allowed = typ[5:].split("|")
            if v not in allowed:
                raise ValueError(f"{v!r} not in {allowed}")
            return v
    except ValueError as e:
        errors.add(where, str(e))
        return None
    raise AssertionError(f"unknown type {typ}")


def load_table(name: str, errors: Errors) -> list[dict]:
    spec = TABLES[name]
    path = CURATED / f"{name}.csv"
    if not path.exists():
        if spec.get("optional_sources") or name in ("tier_overrides", "bundles", "prices"):
            return []
        errors.add(str(path.relative_to(ROOT)), "missing file")
        return []
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames or []
        expected = list(spec["columns"])
        if header != expected:
            missing = [c for c in expected if c not in header]
            extra = [c for c in header if c not in expected]
            errors.add(path.name, f"header mismatch; missing={missing} extra={extra}")
            return []
        rows = []
        for i, raw in enumerate(reader, start=2):
            where = f"{path.name}:{i}"
            row = {}
            for col, (typ, req) in spec["columns"].items():
                val = parse_value(raw.get(col) or "", typ, f"{where} [{col}]", errors)
                if val is None and req == REQUIRED:
                    errors.add(f"{where} [{col}]", "required")
                if col in RANGES and isinstance(val, (int, float)):
                    lo, hi = RANGES[col]
                    if not lo <= val <= hi:
                        errors.add(f"{where} [{col}]", f"{val} outside {lo}..{hi}")
                row[col] = val
            row["_where"] = where
            rows.append(row)
    key = spec["key"]
    if key:
        seen = set()
        for r in rows:
            if r[key] in seen:
                errors.add(r["_where"], f"duplicate {key} {r[key]!r}")
            seen.add(r[key])
    return rows


def load_snapshot(name: str):
    p = SNAPSHOTS / f"{name}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


# ---------------------------------------------------------------- build

def build():
    errors, warnings = Errors(), []
    t = {name: load_table(name, errors) for name in TABLES}
    lines = {r["line_id"]: r for r in t["lines"]}
    classes = {r["class_id"]: r for r in t["ship_classes"]}
    ships = {r["ship_id"]: r for r in t["ships"]}
    tiers = {r["tier_id"]: r for r in t["tiers"]}
    bundles = {r["bundle_id"]: r for r in t["bundles"]}

    # ---- foreign keys & consistency
    for c in classes.values():
        if c["line_id"] not in lines:
            errors.add(c["_where"], f"unknown line_id {c['line_id']}")
    for s in ships.values():
        if s["line_id"] not in lines:
            errors.add(s["_where"], f"unknown line_id {s['line_id']}")
        cls = classes.get(s["class_id"])
        if not cls:
            errors.add(s["_where"], f"unknown class_id {s['class_id']}")
        elif cls["line_id"] != s["line_id"]:
            errors.add(s["_where"], "class belongs to another line")
    for tr in tiers.values():
        if tr["line_id"] not in lines:
            errors.add(tr["_where"], f"unknown line_id {tr['line_id']}")
        if isinstance(tr["ships"], list):
            for sid in tr["ships"]:
                if sid not in ships or ships[sid]["line_id"] != tr["line_id"]:
                    errors.add(tr["_where"], f"ships: {sid} not a ship of {tr['line_id']}")
        if tr["sqft_min"] and tr["sqft_max"] and tr["sqft_min"] > tr["sqft_max"]:
            errors.add(tr["_where"], "sqft_min > sqft_max")
        if tr["included_dining"] == "all" and tr["specialty_meals_included"] not in ("unlimited", None):
            warnings.append(f"{tr['_where']}: included_dining=all but specialty_meals_included={tr['specialty_meals_included']}")
    for b in bundles.values():
        if b["line_id"] not in lines:
            errors.add(b["_where"], f"unknown line_id {b['line_id']}")
        if b["applies_to_tiers"] != "all":
            for tid in b["applies_to_tiers"].split(";"):
                if tid not in tiers or tiers[tid]["line_id"] != b["line_id"]:
                    errors.add(b["_where"], f"applies_to_tiers: {tid} not a tier of {b['line_id']}")
    for sb in t["shareholder_benefits"]:
        if sb["min_nights"] and sb["max_nights"] and sb["min_nights"] > sb["max_nights"]:
            errors.add(sb["_where"], "min_nights > max_nights")
    tickers_with_benefit = {sb["ticker"] for sb in t["shareholder_benefits"]}
    for ln in lines.values():
        if ln["shareholder_benefit"] == "yes" and ln["ticker"] not in tickers_with_benefit:
            errors.add(ln["_where"], f"benefit=yes but no shareholder_benefits rows for {ln['ticker']}")

    overrides: dict[tuple, dict] = {}
    for o in t["tier_overrides"]:
        if o["tier_id"] not in tiers:
            errors.add(o["_where"], f"unknown tier_id {o['tier_id']}")
            continue
        if o["ship_id"] not in ships:
            errors.add(o["_where"], f"unknown ship_id {o['ship_id']}")
            continue
        if o["field"] not in OVERRIDABLE_TIER_FIELDS:
            errors.add(o["_where"], f"field {o['field']!r} not overridable")
            continue
        typ = OVERRIDABLE_TIER_FIELDS[o["field"]][0]
        val = parse_value(o["value"] or "", typ, f"{o['_where']} [value]", errors)
        overrides.setdefault((o["tier_id"], o["ship_id"]), {})[o["field"]] = (val, o)

    prices = {}
    for p in t["prices"]:
        if p["ship_id"] not in ships or p["tier_id"] not in tiers:
            errors.add(p["_where"], "unknown ship_id/tier_id")
            continue
        if p["fare_basis"] != "cruise_only" and p["fare_basis"] not in bundles:
            errors.add(p["_where"], f"fare_basis {p['fare_basis']!r} is not cruise_only or a bundle_id")
        prices[(p["ship_id"], p["tier_id"])] = p

    # ---- snapshots
    cdc = load_snapshot("cdc_vsp")
    cdc_by_name = {r["ship_name"].lower(): r for r in (cdc or {}).get("records", [])}
    wd = load_snapshot("wikidata_ships")

    # ---- sources registry (deterministic ids)
    all_urls = set()
    for name in TABLES:
        for r in t[name]:
            all_urls.update(r.get("source_urls") or [])
    if cdc:
        all_urls.add(cdc["source"])
    src_id = {u: f"s{i + 1}" for i, u in enumerate(sorted(all_urls))}

    def sids(*rows):
        out = set()
        for r in rows:
            for u in (r or {}).get("source_urls") or []:
                out.add(src_id[u])
        return sorted(out, key=lambda s: int(s[1:]))

    # ---- resolve ships
    out_ships = []
    for sid in sorted(ships, key=lambda k: (ships[k]["line_id"], ships[k]["name"])):
        s = ships[sid]
        cls = classes.get(s["class_id"], {})
        rec = {k: s[k] for k in ("ship_id", "line_id", "class_id", "name", "official_url",
                                 "year_built", "last_refit", "gt", "pax_double", "wikidata_qid")}
        rec["class_name"] = cls.get("name")
        amen_src = {}
        for col in AMENITY_COLUMNS:
            if s[col] is not None:
                rec[col], amen_src[col] = s[col], "ship"
            else:
                rec[col], amen_src[col] = cls.get(col), "class"
        rec["amenity_level"] = amen_src
        rec["space_ratio"] = round(s["gt"] / s["pax_double"], 1)
        rec["newest_year"] = max(s["year_built"], s["last_refit"] or s["year_built"])
        hit = cdc_by_name.get((s["cdc_name"] or s["name"]).lower())
        rec["cdc_score"] = hit["cdc_score"] if hit else None
        rec["cdc_date"] = hit["cdc_date"] if hit else None
        src_rows = [s, cls] + ([{"source_urls": [cdc["source"]]}] if hit else [])
        rec["sources"] = sids(*src_rows)
        rec["last_verified"] = max(filter(None, [s["last_verified"], cls.get("last_verified")]))

        # Wikidata cross-check (warnings only; never overrides curated values)
        if wd and s["wikidata_qid"]:
            w = wd["ships"].get(s["wikidata_qid"])
            if not w:
                warnings.append(f"{sid}: wikidata {s['wikidata_qid']} not in snapshot (re-run fetch_wikidata.py)")
            else:
                gts = [float(x) for x in w.get("gt", [])]
                if gts and not any(abs(g - s["gt"]) / s["gt"] <= 0.02 for g in gts):
                    warnings.append(f"{sid}: gt {s['gt']} vs wikidata {w['gt']}")
                yrs = [int(x) for x in w.get("service_entry", [])]
                if yrs and s["year_built"] not in yrs:
                    warnings.append(f"{sid}: year_built {s['year_built']} vs wikidata {w['service_entry']}")
        out_ships.append(rec)
    ship_rec = {s["ship_id"]: s for s in out_ships}

    # ---- rows: ship × tier
    tier_fields = [k for k in TABLES["tiers"]["columns"] if k not in ("ships", "source_urls", "last_verified", "notes")]
    out_rows = []
    for tid in sorted(tiers, key=lambda k: (tiers[k]["line_id"], tiers[k]["rank"], k)):
        tr = tiers[tid]
        ship_ids = [s for s in ships if ships[s]["line_id"] == tr["line_id"]] if tr["ships"] == "all" else tr["ships"]
        for sid in ship_ids:
            row = {k: tr[k] for k in tier_fields}
            row["row_id"] = f"{sid}__{tid}"
            row["ship_id"] = sid
            ov = overrides.get((tid, sid), {})
            used = []
            for field, (val, orow) in sorted(ov.items()):
                row[field] = val
                used.append(orow)
            row["overridden"] = sorted(ov)
            p = prices.get((sid, tid))
            row["fare_pppn_median"] = p["fare_pppn_median"] if p else None
            row["fare_n_sailings"] = p["n_sailings"] if p else None
            row["fare_basis"] = p["fare_basis"] if p else None
            row["fare_as_of"] = p["as_of"] if p else None
            row["fare_source"] = p["source"] if p else None
            row["sources"] = sids(tr, *used)
            row["last_verified"] = max([tr["last_verified"]] + [o["last_verified"] for o in used])
            out_rows.append(row)
    out_rows.sort(key=lambda r: (r["line_id"], ship_rec[r["ship_id"]]["name"], r["rank"], r["tier_id"]))

    # ---- coverage report (% of rows with a known value)
    cov_fields = {
        "row": ["gratuity_pppd", "drinks_included", "wifi_included", "specialty_meals_included", "included_dining",
                "private_restaurant", "private_lounge", "private_sundeck_pool", "laundry_perk", "butler",
                "concierge", "priority_boarding", "thermal_suite_included", "sqft_min", "fare_pppn_median"],
        "ship": list(AMENITY_COLUMNS) + ["cdc_score", "last_refit"],
    }
    coverage = {}
    for lid in sorted(lines):
        lrows = [r for r in out_rows if r["line_id"] == lid]
        lships = [s for s in out_ships if s["line_id"] == lid]
        c = {}
        for f in cov_fields["row"]:
            c[f] = round(100 * sum(r[f] is not None for r in lrows) / len(lrows)) if lrows else 0
        for f in cov_fields["ship"]:
            c[f] = round(100 * sum(s[f] is not None for s in lships) / len(lships)) if lships else 0
        coverage[lid] = {"rows": len(lrows), "ships": len(lships), "pct_known": c}

    def clean(r):
        return {k: v for k, v in r.items() if not k.startswith("_")}

    def with_sources(r):
        d = clean(r)
        if "source_urls" in d:
            d["sources"] = sids(r)
            del d["source_urls"]
        return d

    dates = [r["last_verified"] for name in TABLES for r in t[name] if r.get("last_verified")]
    dates += [p["as_of"] for p in t["prices"]]
    if cdc:
        dates.append(cdc["fetched_on"])
    if wd:
        dates.append(wd["fetched_on"])

    dataset = {
        "schema_version": SCHEMA_VERSION,
        "last_updated": max(dates) if dates else None,
        "snapshots": {
            "cdc_vsp": cdc["fetched_on"] if cdc else None,
            "wikidata": wd["fetched_on"] if wd else None,
        },
        "lines": [with_sources(lines[k]) for k in sorted(lines)],
        "shareholder_benefits": sorted((with_sources(r) for r in t["shareholder_benefits"]),
                                       key=lambda r: (r["ticker"], r["min_nights"])),
        "bundles": [with_sources(bundles[k]) for k in sorted(bundles)],
        "tiers": [with_sources(tiers[k]) for k in sorted(tiers, key=lambda k: (tiers[k]["line_id"], tiers[k]["rank"]))],
        "ships": out_ships,
        "rows": out_rows,
        "sources": {v: k for k, v in sorted(src_id.items(), key=lambda kv: int(kv[1][1:]))},
        "coverage": coverage,
        "warnings": sorted(warnings),
    }
    return dataset, errors, warnings


def render(dataset):
    pretty = json.dumps(dataset, indent=1, sort_keys=True, ensure_ascii=False) + "\n"
    compact = json.dumps(dataset, separators=(",", ":"), sort_keys=True, ensure_ascii=False) + "\n"

    lines = {l["line_id"]: l for l in dataset["lines"]}
    ships = {s["ship_id"]: s for s in dataset["ships"]}
    line_cols = ["name", "segment", "parent", "ticker", "shareholder_benefit", "min_age",
                 "drink_pkg_pppd", "soft_pkg_pppd", "wifi_pppd", "specialty_meal_price"]
    ship_cols = ["name", "class_name", "year_built", "last_refit", "newest_year", "gt", "pax_double",
                 "space_ratio", "cdc_score", "cdc_date", *AMENITY_COLUMNS]
    row_cols = [k for k in dataset["rows"][0] if k not in ("sources", "overridden")] if dataset["rows"] else []
    header = row_cols + [f"line_{c}" for c in line_cols] + [f"ship_{c}" for c in ship_cols] + ["overridden", "source_urls"]
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(header)

    def fmt(v):
        if v is None:
            return ""
        if v is True:
            return "1"
        if v is False:
            return "0"
        if isinstance(v, list):
            return ";".join(map(str, v))
        return str(v)

    for r in dataset["rows"]:
        ln, sh = lines[r["line_id"]], ships[r["ship_id"]]
        urls = sorted({dataset["sources"][s] for s in r["sources"] + sh["sources"] + ln["sources"]})
        w.writerow([fmt(r[c]) for c in row_cols] + [fmt(ln.get(c)) for c in line_cols]
                   + [fmt(sh.get(c)) for c in ship_cols] + [fmt(r["overridden"]), ";".join(urls)])
    return {OUT_JSON: pretty, OUT_SITE: compact, OUT_CSV: buf.getvalue()}


def main(argv):
    check = "--check" in argv
    dataset, errors, warnings = build()
    if errors:
        print(f"{len(errors)} validation error(s):", file=sys.stderr)
        for e in errors:
            print("  " + e, file=sys.stderr)
        return 1
    outputs = render(dataset)
    if check:
        stale = [p for p, text in outputs.items() if not p.exists() or p.read_text(encoding="utf-8") != text]
        if stale:
            print("Out of date: " + ", ".join(str(p.relative_to(ROOT)) for p in stale)
                  + "\nRun: python3 scripts/build.py", file=sys.stderr)
            return 1
        print("Outputs are up to date.")
        return 0
    for p, text in outputs.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    print(f"Built {len(dataset['rows'])} rows · {len(dataset['ships'])} ships · {len(dataset['tiers'])} tiers · "
          f"{len(dataset['lines'])} lines · last_updated {dataset['last_updated']}")
    for lid, c in dataset["coverage"].items():
        gaps = {k: v for k, v in c["pct_known"].items() if v < 100}
        print(f"  {lid}: {c['ships']} ships, {c['rows']} rows; fields <100% known: "
              + (", ".join(f"{k} {v}%" for k, v in gaps.items()) or "none"))
    for wmsg in warnings:
        print("  warning: " + wmsg)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
