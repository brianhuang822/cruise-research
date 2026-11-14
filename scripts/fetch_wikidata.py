#!/usr/bin/env python3
"""Fetch ship specs from Wikidata for every wikidata_qid in data/curated/ships.csv.

Writes data/snapshots/wikidata_ships.json. Wikidata is CC0.
Used only to cross-check curated specs (build.py prints warnings on mismatches).
It never overrides a curated value: Wikidata often mixes double-occupancy, maximum
occupancy and crew counts under the same capacity property.
"""
import csv
import datetime
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHIPS = ROOT / "data" / "curated" / "ships.csv"
OUT = ROOT / "data" / "snapshots" / "wikidata_ships.json"
ENDPOINT = "https://query.wikidata.org/sparql"
UA = "cruise-cabin-finder-data/1.0 (static research site)"

PROPS = {"gt": "P1093", "capacity": "P1083", "service_entry": "P729", "length_m": "P2043"}


def query(qids: list[str]) -> dict:
    values = " ".join(f"wd:{q}" for q in qids)
    optionals = "\n".join(f"OPTIONAL {{ ?ship wdt:{p} ?{k} . }}" for k, p in PROPS.items())
    sparql = f"SELECT ?ship {' '.join('?' + k for k in PROPS)} WHERE {{ VALUES ?ship {{ {values} }} {optionals} }}"
    url = ENDPOINT + "?format=json&query=" + urllib.parse.quote(sparql)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
    for attempt in range(4):
        try:
            data = json.load(urllib.request.urlopen(req, timeout=120))
            break
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == 3:
                raise
            wait = int(e.headers.get("Retry-After") or 65)
            print(f"Wikidata HTTP {e.code}; retrying in {wait}s", file=sys.stderr)
            time.sleep(wait)
    out: dict[str, dict[str, set]] = {q: {k: set() for k in PROPS} for q in qids}
    for b in data["results"]["bindings"]:
        qid = b["ship"]["value"].rsplit("/", 1)[1]
        for k in PROPS:
            if k in b:
                v = b[k]["value"]
                if k == "service_entry":
                    v = v[:4]  # year only
                out[qid][k].add(v)
    return out


def main() -> int:
    with SHIPS.open(encoding="utf-8") as f:
        qids = sorted({r["wikidata_qid"] for r in csv.DictReader(f) if r.get("wikidata_qid")})
    if not qids:
        print("No wikidata_qid values in ships.csv", file=sys.stderr)
        return 1
    result = {}
    for i in range(0, len(qids), 50):
        result.update(query(qids[i:i + 50]))
    snapshot = {
        "source": ENDPOINT,
        "license": "CC0 (Wikidata)",
        "fetched_on": datetime.date.today().isoformat(),
        "properties": PROPS,
        "ships": {q: {k: sorted(v) for k, v in props.items()} for q, props in sorted(result.items())},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, indent=1, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(result)} ships to {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
