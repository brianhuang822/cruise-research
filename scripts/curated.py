"""Load and type-check the curated CSV tables described in schema.py."""

import csv
import json
import re
from collections.abc import Callable
from pathlib import Path

from schema import RANGES, REQUIRED, TABLES

ROOT = Path(__file__).resolve().parent.parent
CURATED = ROOT / "data" / "curated"
SNAPSHOTS = ROOT / "data" / "snapshots"
OPTIONAL_TABLES = {"tier_overrides", "bundles", "prices", "category_map", "ship_deployments", "fare_estimates", "ship_regions"}

SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
URL = re.compile(r"^https?://\S+$")


class Errors(list):
    def add(self, where, msg):
        self.append(f"{where}: {msg}")


def _match(pattern: re.Pattern, label: str) -> Callable[[str], str]:
    def parse(v: str) -> str:
        if not pattern.match(v):
            raise ValueError(f"bad {label} {v!r}")
        return v

    return parse


def _split(v: str) -> list[str]:
    return [p.strip() for p in v.split(";") if p.strip()]


def _num(v: str):
    x = float(v)
    if x < 0:
        raise ValueError("negative amount")
    return int(x) if x.is_integer() else x


def _bool(v: str) -> bool:
    if v not in ("0", "1"):
        raise ValueError(f"bool must be 0/1/blank, got {v!r}")
    return v == "1"


_slug = _match(SLUG, "slug")
_url = _match(URL, "url")

PARSERS: dict[str, Callable[[str], object]] = {
    "slug": _slug,
    "text": str,
    "url": _url,
    "urls": lambda v: [_url(u) for u in _split(v)],
    "date": _match(DATE, "date"),
    "int": int,
    "num": _num,
    "bool": _bool,
    "meals": lambda v: "unlimited" if v == "unlimited" else int(v),
    "ships": lambda v: "all" if v == "all" else [_slug(s) for s in _split(v)],
}


def _enum(typ: str) -> Callable[[str], str]:
    allowed = typ[5:].split("|")

    def parse(v: str) -> str:
        if v not in allowed:
            raise ValueError(f"{v!r} not in {allowed}")
        return v

    return parse


def parse_value(raw: str, typ: str, where: str, errors: Errors):
    v = raw.strip()
    if v == "":
        return None
    parser = _enum(typ) if typ.startswith("enum:") else PARSERS[typ]
    try:
        return parser(v)
    except ValueError as e:
        errors.add(where, str(e))
        return None


def _parse_row(raw: dict, spec: dict, where: str, errors: Errors) -> dict:
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
    return row


def load_table(name: str, errors: Errors) -> list[dict]:
    spec = TABLES[name]
    path = CURATED / f"{name}.csv"
    if not path.exists():
        if name not in OPTIONAL_TABLES:
            errors.add(str(path.relative_to(ROOT)), "missing file")
        return []
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        expected = list(spec["columns"])
        if reader.fieldnames != expected:
            header = reader.fieldnames or []
            missing = [c for c in expected if c not in header]
            extra = [c for c in header if c not in expected]
            errors.add(path.name, f"header mismatch; missing={missing} extra={extra}")
            return []
        rows = [_parse_row(raw, spec, f"{path.name}:{i}", errors) for i, raw in enumerate(reader, start=2)]
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
