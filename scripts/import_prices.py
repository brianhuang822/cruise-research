#!/usr/bin/env python3
"""Turn a raw fare export (e.g. a manual CruisePlum export) into data/curated/prices.csv
and data/curated/ship_deployments.csv. Deterministic: same file + --as-of -> same output.

    python3 scripts/import_prices.py data/raw/export.csv --as-of 2026-12-01
    python3 scripts/import_prices.py data/raw/export.csv --as-of 2026-12-01 --dry-run

Raw exports stay in gitignored data/raw/. Only per ship x tier medians are published.
One row per sailing x cabin category is expected; column names are matched by alias.
"""

import argparse
import csv
import datetime as dt
import io
import re
import statistics
import sys
from collections import defaultdict
from pathlib import Path

from curated import CURATED, Errors, load_table
from schema import TABLES

ALIASES = {
    "line": ["line", "cruise line", "cruiseline", "brand"],
    "ship": ["ship", "ship name", "vessel"],
    "sail_date": ["sail date", "departure date", "departure", "date", "sailing date", "embark date"],
    "nights": ["nights", "length", "duration", "number of nights", "cruise length"],
    "category": ["category", "cabin category", "cabin", "cabin type", "stateroom", "stateroom category", "room type"],
    "price": ["price", "fare", "price pp", "price per person", "lowest price", "cruise fare", "base fare"],
    "region": ["region", "destination", "itinerary region", "area"],
    "port": ["departure port", "embarkation port", "port", "homeport", "from"],
}
DATE_FORMATS = ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%d %b %Y", "%b %d, %Y", "%B %d, %Y")
WINDOW_DAYS = 365


def norm(text: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).split())


def resolve_columns(header: list[str]) -> dict[str, str]:
    by_norm = {norm(h): h for h in header}
    found = {}
    for key, names in ALIASES.items():
        hit = next((by_norm[norm(n)] for n in names if norm(n) in by_norm), None)
        if hit:
            found[key] = hit
    return found


def parse_date(text: str):
    for fmt in DATE_FORMATS:
        try:
            return dt.datetime.strptime(text.strip(), fmt).date()
        except ValueError:
            continue
    return None


def parse_price(text: str):
    cleaned = re.sub(r"[^0-9.]", "", text or "")
    return float(cleaned) if cleaned else None


class ShipIndex:
    """Match export ship names to ship_ids: full name first, then the name without its line prefix."""

    def __init__(self, ships, lines):
        self.full = {norm(s["name"]): s for s in ships}
        self.line_names = {ln["line_id"]: norm(ln["name"]) for ln in lines}
        self.short = defaultdict(list)
        for s in ships:
            n = norm(s["name"])
            for prefix in ("carnival ", "norwegian ", "msc ", "disney ", "oceania ", "celebrity ", "viking "):
                if n.startswith(prefix):
                    self.short[n[len(prefix) :]].append(s)
            self.short[n].append(s)

    def match(self, ship_name: str, line_name: str = ""):
        n = norm(ship_name)
        if n in self.full:
            return self.full[n]
        candidates = self.short.get(n, [])
        if line_name and len(candidates) > 1:
            first_word = norm(line_name).split(" ")[0]
            candidates = [s for s in candidates if self.line_names[s["line_id"]].split(" ")[0] == first_word]
        return candidates[0] if len(candidates) == 1 else None


class TierMapper:
    """First matching pattern (lowest priority number) whose tier is sold on that ship wins."""

    def __init__(self, category_map, tiers):
        self.tiers = {t["tier_id"]: t for t in tiers}
        self.rules = defaultdict(list)
        for r in sorted(category_map, key=lambda r: (r["line_id"], r["priority"], r["tier_id"])):
            self.rules[r["line_id"]].append((re.compile(r["pattern"], re.IGNORECASE), r["tier_id"]))

    def sold_on(self, tier_id, ship_id):
        ships = self.tiers[tier_id]["ships"]
        return ships == "all" or ship_id in ships

    def match(self, ship, category: str):
        for pattern, tier_id in self.rules.get(ship["line_id"], []):
            if pattern.search(category or "") and self.sold_on(tier_id, ship["ship_id"]):
                return tier_id
        return None


def read_rows(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        cols = resolve_columns(reader.fieldnames or [])
        missing = [k for k in ("ship", "sail_date", "nights", "category", "price") if k not in cols]
        if missing:
            raise SystemExit(f"Export is missing columns for {missing}. Headers seen: {reader.fieldnames}")
        return cols, list(reader)


def field(raw: dict, cols: dict, key: str) -> str:
    return (raw.get(cols[key]) or "").strip() if key in cols else ""


def collect(rows, cols, ships, mapper, as_of, per_cabin):
    """Group lowest price per person per night by (ship, tier, sailing); track unmatched values."""
    lowest, deployments = {}, defaultdict(lambda: {"regions": set(), "ports": set(), "months": set(), "sailings": set()})
    misses = {"ship": defaultdict(int), "category": defaultdict(int), "row": 0, "outside_window": 0}
    end = as_of + dt.timedelta(days=WINDOW_DAYS)
    for raw in rows:

        def get(key, raw=raw):
            return field(raw, cols, key)

        ship = ships.match(get("ship"), get("line"))
        date, price = parse_date(get("sail_date")), parse_price(get("price"))
        nights = int(float(get("nights") or 0))
        if not ship:
            misses["ship"][get("ship")] += 1
            continue
        if date is None or price is None or nights <= 0:
            misses["row"] += 1
            continue
        if not as_of <= date < end:
            misses["outside_window"] += 1
            continue
        dep = deployments[ship["ship_id"]]
        dep["sailings"].add(date)
        dep["months"].add(date.strftime("%Y-%m"))
        if get("region"):
            dep["regions"].add(get("region"))
        if get("port"):
            dep["ports"].add(get("port"))
        tier_id = mapper.match(ship, get("category"))
        if not tier_id:
            misses["category"][f"{ship['line_id']}: {get('category')}"] += 1
            continue
        pppn = price / (2 if per_cabin else 1) / nights
        key = (ship["ship_id"], tier_id, date)
        lowest[key] = min(pppn, lowest.get(key, pppn))
    return lowest, deployments, misses


def summarize(lowest, deployments, as_of, source, fare_basis):
    per_tier = defaultdict(list)
    for (ship_id, tier_id, _), pppn in lowest.items():
        per_tier[(ship_id, tier_id)].append(pppn)
    prices = [
        {"ship_id": s, "tier_id": t, "fare_pppn_median": f"{statistics.median(v):.2f}", "n_sailings": len(v),
         "fare_basis": fare_basis, "as_of": as_of.isoformat(), "source": source}
        for (s, t), v in sorted(per_tier.items())
    ]  # fmt: skip
    deploy = [
        {"ship_id": s, "regions": ";".join(sorted(d["regions"])), "homeports": ";".join(sorted(d["ports"])),
         "months": ";".join(sorted(d["months"])), "n_sailings": len(d["sailings"]), "as_of": as_of.isoformat(), "source": source}
        for s, d in sorted(deployments.items())
    ]  # fmt: skip
    return prices, deploy


def to_csv(rows, columns) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=columns, lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue()


def report(prices, deploy, misses, n_rows):
    print(f"Read {n_rows} rows -> {len(prices)} ship x tier fares, {len(deploy)} ships with deployments")
    print(f"  skipped: {misses['outside_window']} outside the 12-month window, {misses['row']} unparseable rows")
    for label, key in (("unmatched ships", "ship"), ("unmapped categories", "category")):
        items = sorted(misses[key].items(), key=lambda kv: -kv[1])
        if items:
            print(f"  {label} ({len(items)}): " + "; ".join(f"{k} x{v}" for k, v in items[:20]))


def write_outputs(prices, deploy, out_dir: Path):
    for name, rows in (("prices", prices), ("ship_deployments", deploy)):
        text = to_csv(rows, list(TABLES[name]["columns"]))
        (out_dir / f"{name}.csv").write_text(text, encoding="utf-8")


def run(opts, out_dir: Path = CURATED):
    errors = Errors()
    t = {name: load_table(name, errors) for name in ("lines", "ships", "tiers", "category_map")}
    if errors:
        raise SystemExit("\n".join(errors))
    cols, rows = read_rows(opts.export)
    ships = ShipIndex(t["ships"], t["lines"])
    mapper = TierMapper(t["category_map"], t["tiers"])
    lowest, deployments, misses = collect(rows, cols, ships, mapper, opts.as_of, opts.per_cabin)
    prices, deploy = summarize(lowest, deployments, opts.as_of, opts.source, opts.fare_basis)
    report(prices, deploy, misses, len(rows))
    if not opts.dry_run:
        write_outputs(prices, deploy, out_dir)
    return prices, deploy, misses


def parse_args(argv):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("export", type=Path)
    ap.add_argument("--as-of", required=True, type=dt.date.fromisoformat, help="export date (next 12 months used)")
    ap.add_argument("--source", default="cruiseplum-manual")
    ap.add_argument("--fare-basis", default="cruise_only", help="'cruise_only' or the bundle_id the export prices include")
    ap.add_argument("--per-cabin", action="store_true", help="prices are per cabin (2 guests), not per person")
    ap.add_argument("--dry-run", action="store_true", help="print the report without writing files")
    return ap.parse_args(argv)


def main(argv):
    run(parse_args(argv))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
