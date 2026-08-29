#!/usr/bin/env python3
"""Generate a large, deterministic sibling of the sales corpus.

The point is not volume for its own sake: every issue planted here is counted
as it is planted, and the counts are written to a manifest. A profiling run can
then be scored against ground truth — found X of X — instead of being taken on
faith.

    python3 scripts/make_large_corpus.py                 # 10,000 rows
    python3 scripts/make_large_corpus.py --rows 50000

Writes data/samples/sales_export_large.csv and
data/samples/large_manifest.json. Fixed seed: same bytes on every run.
"""
import argparse
import csv
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CUSTOMERS = [
    "Acme Corp", "Globex Incorporated", "Initech", "Umbrella Ltd",
    "Stark Industries", "Wayne Enterprises", "Soylent Co", "Hooli",
    "Massive Dynamic", "Vehement Capital",
]
PRODUCTS = {"Widget Pro": 1234.50, "Widget Lite": 89.99, "Gadget X": 2150.00, "Gizmo Mini": 45.00}
# Canonical regions and the variants that must collapse into them.
REGION_VARIANTS = {"NYC": ["NYC", "nyc", "n-y-c", "New York"], "West": ["West", "west"], "East": ["East"]}
STATUS_VARIANTS = {"shipped": ["shipped", "SHIPPED", "Shipped"], "pending": ["pending", "Pending"]}

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def money(v):
    return f"${v:,.2f}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=10000)
    ap.add_argument("--seed", type=int, default=20260830)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    counts = {
        "rows_written": 0, "exact_duplicates": 0, "near_duplicates": 0,
        "dates_iso": 0, "dates_slash_dmy": 0, "dates_text": 0,
        "currency_strings": 0, "unit_suffix_usd": 0, "thousands_separators": 0,
        "region_variants": 0, "status_variants": 0,
        "null_customer": 0, "null_qty": 0, "null_unit_price": 0, "null_total": 0,
        "negative_qty": 0, "wrong_totals": 0,
    }
    ids = {"exact_duplicates": [], "near_duplicates": [], "negative_qty": [], "wrong_totals": []}
    rows = []
    order_id = 100000
    # Day 1 of the window; dates advance so no value lands in the future.
    base_day, base_month, base_year = 1, 3, 2026

    while counts["rows_written"] < args.rows:
        order_id += 1
        product = rng.choice(list(PRODUCTS))
        unit = PRODUCTS[product]
        qty = rng.randint(1, 30)
        total = round(qty * unit, 2)

        day = base_day + (counts["rows_written"] % 28)
        month = base_month + ((counts["rows_written"] // 28) % 2)
        d = min(day, 28)

        # Date representation: ~70% ISO, ~20% slash DMY (day > 12 keeps the
        # order provable), ~10% text.
        roll = rng.random()
        if roll < 0.70:
            date = f"{base_year}-{month:02d}-{d:02d}"
            counts["dates_iso"] += 1
        elif roll < 0.90:
            dd = max(13, d)  # a component > 12 proves day-first
            date = f"{dd:02d}/{month:02d}/{base_year}"
            counts["dates_slash_dmy"] += 1
        else:
            date = f"{MONTHS[month - 1]} {d} {base_year}"
            counts["dates_text"] += 1

        canon_region = rng.choice(list(REGION_VARIANTS))
        region = rng.choice(REGION_VARIANTS[canon_region])
        if region != canon_region:
            counts["region_variants"] += 1
        canon_status = rng.choice(list(STATUS_VARIANTS))
        status = rng.choice(STATUS_VARIANTS[canon_status])
        if status != canon_status:
            counts["status_variants"] += 1

        customer = rng.choice(CUSTOMERS)
        unit_s, total_s = money(unit), money(total)
        counts["currency_strings"] += 2
        if "," in unit_s:
            counts["thousands_separators"] += 1
        if "," in total_s:
            counts["thousands_separators"] += 1

        # Planted defects, at deterministic rates.
        defect = rng.random()
        if defect < 0.004:  # currency written with a unit suffix
            unit_s = f"{unit:,.2f} USD"
            counts["unit_suffix_usd"] += 1
        elif defect < 0.010:  # arithmetic that does not reconcile
            total_s = money(round(total + rng.choice([200, 430, -150]), 2))
            counts["wrong_totals"] += 1
            ids["wrong_totals"].append(order_id)
        elif defect < 0.013:  # impossible negative quantity on a cancelled order
            qty = -qty
            total_s = f"-{money(abs(round(qty * unit, 2)))}"
            # Overwriting status retracts the variant counted above.
            if status != canon_status:
                counts["status_variants"] -= 1
            status = canon_status = "cancelled"
            counts["negative_qty"] += 1
            ids["negative_qty"].append(order_id)
        elif defect < 0.020:  # missing customer
            customer = ""
            counts["null_customer"] += 1
        elif defect < 0.024:  # missing quantity, derivable from total / unit
            qty = ""
            counts["null_qty"] += 1
        elif defect < 0.026:  # all three financial fields absent
            qty, unit_s, total_s = "", "", ""
            counts["null_qty"] += 1
            counts["null_unit_price"] += 1
            counts["null_total"] += 1
            counts["currency_strings"] -= 2

        row = [order_id, date, customer, region, product, qty, unit_s, total_s, status]
        rows.append(row)
        counts["rows_written"] += 1

        # A double import duplicates whole rows.
        def recount_copy():
            """A copied row repeats its date form and category variants, so the
            manifest must count those cells again to stay exact."""
            if roll < 0.70:
                counts["dates_iso"] += 1
            elif roll < 0.90:
                counts["dates_slash_dmy"] += 1
            else:
                counts["dates_text"] += 1
            if region != canon_region:
                counts["region_variants"] += 1
            if status != canon_status:
                counts["status_variants"] += 1
            if "USD" in unit_s:
                counts["unit_suffix_usd"] += 1
            if defect < 0.010 and defect >= 0.004:
                counts["wrong_totals"] += 1

        if rng.random() < 0.005 and counts["rows_written"] < args.rows:
            rows.append(list(row))
            counts["rows_written"] += 1
            counts["exact_duplicates"] += 1
            ids["exact_duplicates"].append(order_id)
            recount_copy()
        # A near-duplicate: same everything, new id.
        elif rng.random() < 0.003 and counts["rows_written"] < args.rows:
            order_id += 1
            near = list(row)
            near[0] = order_id
            rows.append(near)
            counts["rows_written"] += 1
            counts["near_duplicates"] += 1
            ids["near_duplicates"].append(order_id)
            recount_copy()

    out = ROOT / "data" / "samples" / "sales_export_large.csv"
    with out.open("w", newline="") as fh:
        w = csv.writer(fh, quoting=csv.QUOTE_MINIMAL)
        w.writerow(["order_id", "order_date", "customer", "region", "product", "qty", "unit_price", "total", "status"])
        for r in rows:
            w.writerow(r)

    manifest = {
        "generator": "scripts/make_large_corpus.py",
        "seed": args.seed,
        "file": "data/samples/sales_export_large.csv",
        "planted": counts,
        "ids": {k: v[:20] for k, v in ids.items()},
        "note": "Ground truth for scoring a profiling run: every count here was "
                "incremented as the issue was planted. 'ids' lists the first 20 "
                "of each class for spot-checking.",
    }
    (ROOT / "data" / "samples" / "large_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote {out} ({counts['rows_written']} rows)")
    for k, v in counts.items():
        print(f"  {k:24} {v}")


if __name__ == "__main__":
    main()
