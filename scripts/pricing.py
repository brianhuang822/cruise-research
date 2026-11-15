"""All-in price engine — Python mirror of docs/pricing.js (roadmap.md §5).

Use for analysis, e.g.:

    import json, pricing
    ds = json.load(open("data/dataset.json"))
    lines = {l["line_id"]: l for l in ds["lines"]}
    inputs = {"nights": 7, "tickers": ["RCL"], "drinks": "alcohol", "wifi": True, "dinners": 1}
    for row in ds["rows"]:
        print(row["row_id"], pricing.all_in(row, lines[row["line_id"]], ds["bundles"], ds["shareholder_benefits"], inputs))
"""

DRINK_LEVEL = {"none": 0, "soft": 1, "alcohol": 2}
GUESTS = 2


def _r2(x: float) -> float:
    # match JS Math.round(x*100)/100 (round half up for positives)
    import math

    return math.floor(x * 100 + 0.5) / 100


def _meals_covered(a, b):
    if a == "unlimited" or b == "unlimited":
        return "unlimited"
    if a is None and b is None:
        return None
    return (a or 0) + (b or 0)


def _max_drinks(a, b):
    if a is None:
        return b
    if b is None:
        return a
    return a if DRINK_LEVEL[a] >= DRINK_LEVEL[b] else b


def _extras_cost(inputs, cover, line):
    parts, missing = {}, []

    if cover["gratuities"]:
        parts["gratuity"] = 0
    elif cover["gratuity_pppd"] is None:
        missing.append("gratuity")
    else:
        parts["gratuity"] = cover["gratuity_pppd"]

    want = inputs.get("drinks") or "none"
    if want == "none":
        parts["drinks"] = 0
    elif cover["drinks"] is None:
        missing.append("drinks_included")
    elif DRINK_LEVEL[cover["drinks"]] >= DRINK_LEVEL[want]:
        parts["drinks"] = 0
    else:
        key = "drink_pkg_pppd" if want == "alcohol" else "soft_pkg_pppd"
        if line.get(key) is None:
            missing.append(key)
        else:
            parts["drinks"] = line[key]

    if not inputs.get("wifi"):
        parts["wifi"] = 0
    elif cover["wifi"] is None:
        missing.append("wifi_included")
    elif cover["wifi"]:
        parts["wifi"] = 0
    elif line.get("wifi_pppd") is None:
        missing.append("wifi_pppd")
    else:
        parts["wifi"] = line["wifi_pppd"]

    d = inputs.get("dinners") or 0
    if d == 0:
        parts["specialty"] = 0
    elif cover["meals"] is None:
        missing.append("specialty_meals_included")
    elif cover["meals"] == "unlimited":
        parts["specialty"] = 0
    else:
        extra = max(0, d - cover["meals"])
        if extra == 0:
            parts["specialty"] = 0
        elif line.get("specialty_meal_price") is None:
            missing.append("specialty_meal_price")
        else:
            parts["specialty"] = extra * line["specialty_meal_price"] / inputs["nights"]

    if missing:
        return None, parts, missing
    return parts["gratuity"] + parts["drinks"] + parts["wifi"] + parts["specialty"], parts, missing


def bundle_applies(bundle, tier_id):
    return bundle["applies_to_tiers"] == "all" or tier_id in bundle["applies_to_tiers"].split(";")


def obc_for(line, inputs, benefits):
    tickers = inputs.get("tickers") or []
    if not line.get("ticker") or line["ticker"] not in tickers:
        return {"pppn": 0, "status": "none", "note": None}
    if line.get("shareholder_benefit") == "unknown":
        return {"pppn": 0, "status": "unknown", "note": "Shareholder credit not confirmed for this line"}
    if line.get("shareholder_benefit") != "yes":
        return {"pppn": 0, "status": "none", "note": None}
    n = inputs["nights"]
    tier = next((b for b in benefits if b["ticker"] == line["ticker"] and b["min_nights"] <= n <= b["max_nights"]), None)
    if tier is None:
        return {"pppn": 0, "status": "none", "note": None}
    note = (
        f"Confirmed for sailings through {tier['valid_through']}. Expected after that, but not confirmed."
        if tier.get("valid_through")
        else None
    )
    return {
        "pppn": tier["obc_usd"] / GUESTS / n,
        "status": "expected_after_valid_through" if tier.get("valid_through") else "applied",
        "note": note,
    }


def all_in(row, line, bundles, benefits, inputs):
    base = {
        "gratuities": row.get("gratuity_pppd") == 0,
        "gratuity_pppd": row.get("gratuity_pppd"),
        "drinks": row.get("drinks_included"),
        "wifi": row.get("wifi_included"),
        "meals": row.get("specialty_meals_included"),
    }
    total, parts, missing = _extras_cost(inputs, base, line)
    best = {"method": "a_la_carte", "total": total, "parts": parts, "missing": missing}

    for b in bundles:
        if b["line_id"] != row["line_id"] or b.get("price_pppd") is None or not bundle_applies(b, row["tier_id"]):
            continue
        cover = {
            "gratuities": base["gratuities"] or b.get("covers_gratuities") is True,
            "gratuity_pppd": base["gratuity_pppd"],
            "drinks": _max_drinks(base["drinks"], b.get("covers_drinks")),
            "wifi": True if (base["wifi"] is True or b.get("covers_wifi") is True) else base["wifi"],
            "meals": _meals_covered(base["meals"], b.get("covers_specialty_meals")),
        }
        t, p, _missing = _extras_cost(inputs, cover, line)
        if t is None:
            continue
        t += b["price_pppd"]
        if best["total"] is None or t < best["total"] - 1e-9:
            best = {"method": b["bundle_id"], "total": t, "parts": {**p, "bundle": b["price_pppd"]}, "missing": []}

    obc = obc_for(line, inputs, benefits)
    # Real median first; otherwise the line-and-cabin-type estimate (D57), flagged.
    fare = row.get("fare_pppn_median")
    estimated = fare is None and row.get("fare_est_pppn") is not None
    if estimated:
        fare = row["fare_est_pppn"]
    extras = best["total"]
    result_all_in = _r2(fare + extras - obc["pppn"]) if (fare is not None and extras is not None) else None
    missing = list(best["missing"]) + (["fare"] if fare is None else [])
    return {
        "fare": fare,
        "estimated": estimated,
        "extras": None if extras is None else _r2(extras),
        "method": best["method"],
        "parts": {k: _r2(v) for k, v in best["parts"].items()},
        "obc": _r2(obc["pppn"]),
        "obc_status": obc["status"],
        "obc_note": obc["note"],
        "all_in": result_all_in,
        "missing": missing,
    }
