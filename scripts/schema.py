"""Column specs for every curated CSV. Single source of truth for validation and docs.

Type codes
  slug       lowercase id: [a-z0-9-]+
  text       free text
  url        one http(s) URL
  urls       ';'-separated http(s) URLs (required on every fact row)
  date       YYYY-MM-DD
  int, num   integer / decimal (blank = unknown)
  bool       1 / 0 / blank (blank = unknown, never "didn't check" -> 0)
  enum:a|b   one of the listed values or blank
  meals      integer or 'unlimited' (or blank)
  ships      'all' or ';'-separated ship_ids
"""

REQUIRED = "required"  # marker: blank not allowed

DRINKS = "enum:none|soft|alcohol"
LAUNDRY_PERK = "enum:none|pressing|limited|unlimited"
INCLUDED_DINING = "enum:main_only|some_specialty|all"
TIER_TYPE = "enum:interior|oceanview|balcony|junior_suite|perk_class|suite|top_suite"
SELF_LAUNDRY = "enum:none|paid|free"
THERMAL = "enum:none|paid|included"

AMENITY_COLUMNS = {
    "specialty_restaurants": ("int", None),
    "pickleball": ("bool", None),
    "sports_court": ("bool", None),
    "running_track": ("bool", None),
    "self_laundry": (SELF_LAUNDRY, None),
    "thermal_suite": (THERMAL, None),
    "adults_only_pool": ("bool", None),
    "pools": ("int", None),
    "kids_club": ("bool", None),
    "teen_club": ("bool", None),
    "water_slides": ("bool", None),
    "mini_golf": ("bool", None),
    "splash_area": ("bool", None),
    "promenade_deck": ("bool", None),  # outdoor deck you can walk all the way around
    "covered_pool": ("bool", None),  # a pool under a fixed or retractable roof
}

SOURCE_COLUMNS = {
    "source_urls": ("urls", REQUIRED),
    "last_verified": ("date", REQUIRED),
    "notes": ("text", None),
}

TABLES = {
    "lines": {
        "key": "line_id",
        "columns": {
            "line_id": ("slug", REQUIRED),
            "name": ("text", REQUIRED),
            "segment": ("enum:mainstream|premium|luxury", REQUIRED),
            "parent": ("text", REQUIRED),
            "ticker": ("enum:CCL|RCL|NCLH", None),
            "shareholder_benefit": ("enum:yes|no|unknown", REQUIRED),
            "min_age": ("int", None),
            "drink_pkg_pppd": ("num", None),
            "soft_pkg_pppd": ("num", None),
            "wifi_pppd": ("num", None),
            "specialty_meal_price": ("num", None),
            "official_url": ("url", REQUIRED),
            **SOURCE_COLUMNS,
        },
    },
    "shareholder_benefits": {
        "key": None,
        "columns": {
            "ticker": ("enum:CCL|RCL|NCLH", REQUIRED),
            "min_nights": ("int", REQUIRED),
            "max_nights": ("int", REQUIRED),
            "obc_usd": ("num", REQUIRED),
            "valid_through": ("date", None),
            **SOURCE_COLUMNS,
        },
    },
    "bundles": {
        "key": "bundle_id",
        "columns": {
            "bundle_id": ("slug", REQUIRED),
            "line_id": ("slug", REQUIRED),
            "name": ("text", REQUIRED),
            "price_pppd": ("num", None),
            "covers_drinks": (DRINKS, REQUIRED),
            "covers_wifi": ("bool", REQUIRED),
            "covers_specialty_meals": ("meals", REQUIRED),
            "covers_gratuities": ("bool", REQUIRED),
            "applies_to_tiers": ("text", REQUIRED),
            **SOURCE_COLUMNS,
        },
    },
    "tiers": {
        "key": "tier_id",
        "columns": {
            "tier_id": ("slug", REQUIRED),
            "line_id": ("slug", REQUIRED),
            "name": ("text", REQUIRED),
            "tier_type": (TIER_TYPE, REQUIRED),
            "rank": ("int", REQUIRED),
            "gratuity_pppd": ("num", None),
            "drinks_included": (DRINKS, None),
            "wifi_included": ("bool", None),
            "specialty_meals_included": ("meals", None),
            "included_dining": (INCLUDED_DINING, None),
            "private_restaurant": ("bool", None),
            "private_lounge": ("bool", None),
            "private_sundeck_pool": ("bool", None),
            "laundry_perk": (LAUNDRY_PERK, None),
            "butler": ("bool", None),
            "concierge": ("bool", None),
            "priority_boarding": ("bool", None),
            "thermal_suite_included": ("bool", None),
            "sqft_min": ("int", None),
            "sqft_max": ("int", None),
            "max_guests": ("int", None),
            "ships": ("ships", REQUIRED),
            **SOURCE_COLUMNS,
        },
    },
    "tier_overrides": {
        "key": None,
        "columns": {
            "tier_id": ("slug", REQUIRED),
            "ship_id": ("slug", REQUIRED),
            "field": ("text", REQUIRED),
            "value": ("text", None),
            **SOURCE_COLUMNS,
        },
    },
    "ship_classes": {
        "key": "class_id",
        "columns": {
            "class_id": ("slug", REQUIRED),
            "line_id": ("slug", REQUIRED),
            "name": ("text", REQUIRED),
            **AMENITY_COLUMNS,
            **SOURCE_COLUMNS,
        },
    },
    "ships": {
        "key": "ship_id",
        "columns": {
            "ship_id": ("slug", REQUIRED),
            "line_id": ("slug", REQUIRED),
            "class_id": ("slug", REQUIRED),
            "name": ("text", REQUIRED),
            "wikidata_qid": ("text", None),
            "cdc_name": ("text", None),
            "official_url": ("url", REQUIRED),
            "year_built": ("int", REQUIRED),
            "last_refit": ("int", None),
            "gt": ("int", REQUIRED),
            "pax_double": ("int", REQUIRED),
            **AMENITY_COLUMNS,  # non-blank values override the class
            **SOURCE_COLUMNS,
        },
    },
    "category_map": {
        "key": None,
        "columns": {
            "line_id": ("slug", REQUIRED),
            "priority": ("int", REQUIRED),
            "pattern": ("text", REQUIRED),  # case-insensitive regex matched against the export's cabin category
            "tier_id": ("slug", REQUIRED),
            "notes": ("text", None),
        },
    },
    "ship_deployments": {
        "key": "ship_id",
        "columns": {
            "ship_id": ("slug", REQUIRED),
            "regions": ("text", None),  # ';'-separated, from the price export
            "homeports": ("text", None),  # ';'-separated departure ports
            "months": ("text", None),  # ';'-separated YYYY-MM with sailings
            "n_sailings": ("int", REQUIRED),
            "as_of": ("date", REQUIRED),
            "source": ("text", REQUIRED),
        },
    },
    "fare_estimates": {
        "key": "line_id",
        "columns": {
            "line_id": ("slug", REQUIRED),
            "basis": ("enum:tracker|lead_in", REQUIRED),
            "interior": ("num", None),
            "oceanview": ("num", None),
            "balcony": ("num", None),
            "suite": ("num", None),
            "lead_in_pppn": ("num", None),
            "lead_in_tier_type": (TIER_TYPE, None),
            "samples": ("text", REQUIRED),
            **SOURCE_COLUMNS,
        },
    },
    "prices": {
        "key": None,
        "columns": {
            "ship_id": ("slug", REQUIRED),
            "tier_id": ("slug", REQUIRED),
            "fare_pppn_median": ("num", REQUIRED),
            "n_sailings": ("int", REQUIRED),
            "fare_basis": ("text", REQUIRED),  # 'cruise_only' or a bundle_id
            "as_of": ("date", REQUIRED),
            "source": ("text", REQUIRED),
        },
        "optional_sources": True,
    },
}

RANGES = {
    "gt": (1_000, 260_000),
    "pax_double": (50, 8_000),
    "year_built": (1985, 2027),
    "last_refit": (1985, 2027),
    "min_age": (0, 21),
    "rank": (1, 20),
    "sqft_min": (80, 6_000),
    "sqft_max": (80, 6_000),
    "max_guests": (1, 12),
    "pools": (0, 20),
    "specialty_restaurants": (0, 40),
    "min_nights": (1, 999),
    "max_nights": (1, 999),
    "priority": (1, 99),
}

# Tier fields that tier_overrides may change, with their types.
OVERRIDABLE_TIER_FIELDS = {
    k: v
    for k, v in TABLES["tiers"]["columns"].items()
    if k not in ("tier_id", "line_id", "name", "tier_type", "rank", "ships", "source_urls", "last_verified", "notes")
}
