"""Run: python3 -m unittest discover -s tests -v"""
import itertools
import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import build  # noqa: E402
import pricing  # noqa: E402


def fixture():
    line = {"line_id": "x", "ticker": "RCL", "shareholder_benefit": "yes", "drink_pkg_pppd": 100,
            "soft_pkg_pppd": 15, "wifi_pppd": 20, "specialty_meal_price": 70}
    benefits = [{"ticker": "RCL", "min_nights": 1, "max_nights": 5, "obc_usd": 50, "valid_through": None},
                {"ticker": "RCL", "min_nights": 6, "max_nights": 13, "obc_usd": 100, "valid_through": None},
                {"ticker": "RCL", "min_nights": 14, "max_nights": 999, "obc_usd": 250, "valid_through": "2026-12-31"}]
    bundles = [{"bundle_id": "b1", "line_id": "x", "price_pppd": 90, "covers_drinks": "alcohol", "covers_wifi": True,
                "covers_specialty_meals": 1, "covers_gratuities": False, "applies_to_tiers": "t1"}]
    rows = [
        {"line_id": "x", "tier_id": "t1", "fare_pppn_median": 150, "gratuity_pppd": 19.5, "drinks_included": "none",
         "wifi_included": False, "specialty_meals_included": 0},
        {"line_id": "x", "tier_id": "t2", "fare_pppn_median": 400, "gratuity_pppd": 0, "drinks_included": "alcohol",
         "wifi_included": True, "specialty_meals_included": "unlimited"},
        {"line_id": "x", "tier_id": "t1", "fare_pppn_median": None, "gratuity_pppd": None, "drinks_included": None,
         "wifi_included": None, "specialty_meals_included": None},
        {"line_id": "x", "tier_id": "t3", "fare_pppn_median": 210, "gratuity_pppd": 18, "drinks_included": "soft",
         "wifi_included": False, "specialty_meals_included": 2},
    ]
    grid = [{"nights": n, "tickers": tk, "drinks": dr, "wifi": wf, "dinners": dn}
            for n, tk, dr, wf, dn in itertools.product([3, 7, 14], [[], ["RCL"]], ["none", "soft", "alcohol"],
                                                       [False, True], [0, 1, 3])]
    return line, benefits, bundles, rows, grid


class PricingTests(unittest.TestCase):
    def test_example_from_roadmap(self):
        # roadmap §5.4: $150 fare + $20 grats + $85 drinks + $20 wifi + one $60 dinner, 7 nights = $283.57
        line = {"line_id": "x", "ticker": None, "drink_pkg_pppd": 85, "wifi_pppd": 20, "specialty_meal_price": 60}
        row = {"line_id": "x", "tier_id": "t", "fare_pppn_median": 150, "gratuity_pppd": 20, "drinks_included": "none",
               "wifi_included": False, "specialty_meals_included": 0}
        r = pricing.all_in(row, line, [], [], {"nights": 7, "drinks": "alcohol", "wifi": True, "dinners": 1})
        self.assertEqual(r["all_in"], 283.57)

    def test_shareholder_credit(self):
        line, benefits, bundles, rows, _ = fixture()
        r = pricing.all_in(rows[1], line, bundles, benefits, {"nights": 7, "tickers": ["RCL"], "drinks": "none"})
        self.assertAlmostEqual(r["obc"], 7.14)
        self.assertEqual(r["all_in"], 392.86)

    def test_bundle_chosen_when_cheaper(self):
        line, benefits, bundles, rows, _ = fixture()
        r = pricing.all_in(rows[0], line, bundles, benefits, {"nights": 7, "drinks": "alcohol", "wifi": True, "dinners": 1})
        self.assertEqual(r["method"], "b1")  # 90+19.5 < 100+20+10+19.5

    def test_unknown_propagates(self):
        line, benefits, bundles, rows, _ = fixture()
        r = pricing.all_in(rows[2], line, bundles, benefits, {"nights": 7})
        self.assertIsNone(r["all_in"])
        self.assertIn("fare", r["missing"])

    @unittest.skipUnless(shutil.which("node"), "node not installed")
    def test_js_python_parity(self):
        line, benefits, bundles, rows, grid = fixture()
        cases = [{"row": r, "inputs": g} for r in rows for g in grid]
        js = (
            "import { allIn } from './docs/pricing.js';"
            "import fs from 'fs';"
            "const c = JSON.parse(fs.readFileSync(0, 'utf8'));"
            "process.stdout.write(JSON.stringify(c.cases.map(k => allIn(k.row, c.line, c.bundles, c.benefits, k.inputs))));"
        )
        out = subprocess.run(["node", "--input-type=module", "-e", js], cwd=ROOT, check=True, capture_output=True,
                             input=json.dumps({"cases": cases, "line": line, "bundles": bundles, "benefits": benefits}),
                             text=True).stdout
        js_results = json.loads(out)
        for case, jr in zip(cases, js_results):
            pr = pricing.all_in(case["row"], line, bundles, benefits, case["inputs"])
            jr.pop("obc_usd", None)
            self.assertEqual(json.loads(json.dumps(pr)), jr, msg=json.dumps(case))


class BuildTests(unittest.TestCase):
    def test_build_is_deterministic(self):
        a, err_a, _ = build.build()
        b, err_b, _ = build.build()
        self.assertEqual(err_a, [])
        self.assertEqual(build.render(a), build.render(b))

    def test_committed_outputs_up_to_date(self):
        ds, errors, _ = build.build()
        self.assertEqual(errors, [])
        for path, text in build.render(ds).items():
            self.assertTrue(path.exists(), path)
            self.assertEqual(path.read_text(encoding="utf-8"), text, f"{path} stale: run scripts/build.py")

    def test_rows_reference_known_entities(self):
        ds, _, _ = build.build()
        ships = {s["ship_id"] for s in ds["ships"]}
        tiers = {t["tier_id"] for t in ds["tiers"]}
        for r in ds["rows"]:
            self.assertIn(r["ship_id"], ships)
            self.assertIn(r["tier_id"], tiers)
            for s in r["sources"]:
                self.assertIn(s, ds["sources"])

    def test_validation_catches_bad_bool(self):
        errs = build.Errors()
        self.assertIsNone(build.parse_value("yes", "bool", "t", errs))
        self.assertEqual(len(errs), 1)


if __name__ == "__main__":
    unittest.main()
