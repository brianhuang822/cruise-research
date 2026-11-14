"""Serialize a built dataset to its three committed outputs (deterministic)."""

import csv
import io
import json

from curated import ROOT
from schema import AMENITY_COLUMNS

OUT_JSON = ROOT / "data" / "dataset.json"
OUT_CSV = ROOT / "data" / "dataset.csv"
OUT_SITE = ROOT / "docs" / "data.json"

LINE_COLS = ["name", "segment", "parent", "ticker", "shareholder_benefit", "min_age",
             "drink_pkg_pppd", "soft_pkg_pppd", "wifi_pppd", "specialty_meal_price"]  # fmt: skip
SHIP_COLS = ["name", "class_name", "year_built", "last_refit", "newest_year", "gt", "pax_double",
             "space_ratio", "cdc_score", "cdc_date", *AMENITY_COLUMNS]  # fmt: skip


def _cell(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, list):
        return ";".join(map(str, v))
    return str(v)


def flat_csv(dataset) -> str:
    """One row per ship-and-tier combination, with line and ship fields prefixed, for pandas/spreadsheets."""
    lines = {ln["line_id"]: ln for ln in dataset["lines"]}
    ships = {s["ship_id"]: s for s in dataset["ships"]}
    rows = dataset["rows"]
    row_cols = [k for k in rows[0] if k not in ("sources", "overridden")] if rows else []
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(row_cols + [f"line_{c}" for c in LINE_COLS] + [f"ship_{c}" for c in SHIP_COLS] + ["overridden", "source_urls"])
    for r in rows:
        ln, sh = lines[r["line_id"]], ships[r["ship_id"]]
        urls = sorted({dataset["sources"][s] for s in r["sources"] + sh["sources"] + ln["sources"]})
        w.writerow(
            [_cell(r[c]) for c in row_cols]
            + [_cell(ln.get(c)) for c in LINE_COLS]
            + [_cell(sh.get(c)) for c in SHIP_COLS]
            + [_cell(r["overridden"]), ";".join(urls)]
        )
    return buf.getvalue()


def render(dataset) -> dict:
    pretty = json.dumps(dataset, indent=1, sort_keys=True, ensure_ascii=False) + "\n"
    compact = json.dumps(dataset, separators=(",", ":"), sort_keys=True, ensure_ascii=False) + "\n"
    return {OUT_JSON: pretty, OUT_SITE: compact, OUT_CSV: flat_csv(dataset)}
