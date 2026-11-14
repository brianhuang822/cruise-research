#!/usr/bin/env python3
"""Fetch the CDC Vessel Sanitation Program "Green Sheet" (latest score per ship).

Writes data/snapshots/cdc_vsp.json. CDC data is US public domain.
Re-run to refresh; review the git diff before committing.
"""

import datetime
import hashlib
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

URL = "https://wwwn.cdc.gov/inspectionquerytool/InspectionGreenSheetRpt.aspx"
OUT = Path(__file__).resolve().parent.parent / "data" / "snapshots" / "cdc_vsp.json"
UA = "cruise-cabin-finder-data/1.0 (static research site)"

# Markup differs by user agent (modern <td style> vs legacy <font> tags), so match the
# ship link, then read date + score from the tag-stripped text up to the end of that row.
LINK = re.compile(r"<a[^>]*InspectionDetailReport\.aspx[^>]*>(.*?)</a>(.*?)</tr>", re.DOTALL | re.IGNORECASE)
TAGS = re.compile(r"<[^>]+>")
CELLS = re.compile(r"(\d{2})/(\d{2})/(\d{4})\s+(\d{1,3})\b")


def parse(page: str) -> list[dict]:
    records = {}
    for name_html, rest in LINK.findall(page):
        name = " ".join(html.unescape(TAGS.sub(" ", name_html)).split())
        m = CELLS.search(" ".join(html.unescape(TAGS.sub(" ", rest)).split()))
        if not name or not m:
            continue
        mm, dd, yyyy, score = m.groups()
        records[name] = {"ship_name": name, "cdc_date": f"{yyyy}-{mm}-{dd}", "cdc_score": int(score)}
    return sorted(records.values(), key=lambda r: r["ship_name"].lower())


def main() -> int:
    req = urllib.request.Request(URL, headers={"User-Agent": UA})
    raw = urllib.request.urlopen(req, timeout=60).read()
    records = parse(raw.decode("utf-8", errors="replace"))
    if len(records) < 50:
        print(f"Parsed only {len(records)} records; page layout may have changed.", file=sys.stderr)
        return 1
    snapshot = {
        "source": URL,
        "license": "US public domain (CDC)",
        "fetched_on": datetime.datetime.now(datetime.UTC).date().isoformat(),
        "sha256_raw": hashlib.sha256(raw).hexdigest(),
        "records": records,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, indent=1, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} ships to {OUT.relative_to(OUT.parents[2])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
