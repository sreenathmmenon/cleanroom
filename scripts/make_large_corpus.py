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
import collections
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

CANONICAL_REGIONS = set(REGION_VARIANTS)
CANONICAL_STATUSES = set(STATUS_VARIANTS) | {"cancelled"}

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def money(v):
    return f"${v:,.2f}"


def tally(rows):
    """Derive ground truth from the rows that were actually written.

    Counting at plant time is fragile: a duplicated row repeats every defect it
    carries, and a later mutation can introduce one (a total pushed past 1,000
    gains a thousands separator). Counting the finished rows instead means the
    manifest cannot disagree with the file it describes.
    """
    counts = collections.Counter()
    counts["rows_written"] = len(rows)

    seen = collections.Counter(tuple(r) for r in rows)
    counts["exact_duplicates"] = sum(c - 1 for c in seen.values() if c > 1)

    # Near-duplicates share the logical key but are not byte-identical: the case
    # a plain drop_duplicates() misses.
    by_key = collections.defaultdict(list)
    for r in rows:
        by_key[r[0]].append(tuple(r))
    counts["near_duplicates"] = sum(
        1 for variants in by_key.values() if len(variants) > 1 and len(set(variants)) > 1
    )

    for r in rows:
        _oid, date, customer, region, _product, qty, unit_s, total_s, status = r
        if "/" in date:
            counts["dates_slash_dmy"] += 1
        elif date.count("-") == 2:
            counts["dates_iso"] += 1
        else:
            counts["dates_text"] += 1

        if region.strip() not in CANONICAL_REGIONS:
            counts["region_variants"] += 1
        if status.strip() not in CANONICAL_STATUSES:
            counts["status_variants"] += 1

        for cell in (unit_s, total_s):
            if "$" in cell or "USD" in cell:
                counts["currency_strings"] += 1
            if "," in cell:
                counts["thousands_separators"] += 1
        if "USD" in unit_s:
            counts["unit_suffix_usd"] += 1

        if not customer.strip():
            counts["null_customer"] += 1
        if qty == "":
            counts["null_qty"] += 1
        if unit_s == "":
            counts["null_unit_price"] += 1
        if total_s == "":
            counts["null_total"] += 1

        try:
            q = float(qty)
            if q < 0:
                counts["negative_qty"] += 1
            u = float(unit_s.replace("$", "").replace(",", "").replace(" USD", ""))
            t = float(total_s.replace("-$", "-").replace("$", "").replace(",", ""))
            if abs(q * u - t) > 0.01:
                counts["wrong_totals"] += 1
        except ValueError:
            pass

    return dict(counts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=10000)
    ap.add_argument("--seed", type=int, default=20260830)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    ids = {"exact_duplicates": [], "near_duplicates": [], "negative_qty": [], "wrong_totals": []}
    rows = []
    order_id = 100000
    # Day 1 of the window; dates advance so no value lands in the future.
    base_day, base_month, base_year = 1, 3, 2026

    while len(rows) < args.rows:
        order_id += 1
        product = rng.choice(list(PRODUCTS))
        unit = PRODUCTS[product]
        qty = rng.randint(1, 30)
        total = round(qty * unit, 2)

        day = base_day + (len(rows) % 28)
        month = base_month + ((len(rows) // 28) % 2)
        d = min(day, 28)

        # Date representation: ~70% ISO, ~20% slash DMY (day > 12 keeps the
        # order provable), ~10% text.
        roll = rng.random()
        if roll < 0.70:
            date = f"{base_year}-{month:02d}-{d:02d}"
        elif roll < 0.90:
            dd = max(13, d)  # a component > 12 proves day-first
            date = f"{dd:02d}/{month:02d}/{base_year}"
        else:
            date = f"{MONTHS[month - 1]} {d} {base_year}"

        canon_region = rng.choice(list(REGION_VARIANTS))
        region = rng.choice(REGION_VARIANTS[canon_region])
        canon_status = rng.choice(list(STATUS_VARIANTS))
        status = rng.choice(STATUS_VARIANTS[canon_status])

        customer = rng.choice(CUSTOMERS)
        unit_s, total_s = money(unit), money(total)

        # Planted defects, at deterministic rates.
        defect = rng.random()
        if defect < 0.004:  # currency written with a unit suffix
            unit_s = f"{unit:,.2f} USD"
        elif defect < 0.010:  # arithmetic that does not reconcile
            total_s = money(round(total + rng.choice([200, 430, -150]), 2))
            ids["wrong_totals"].append(order_id)
        elif defect < 0.013:  # impossible negative quantity on a cancelled order
            qty = -qty
            total_s = f"-{money(abs(round(qty * unit, 2)))}"
            status = canon_status = "cancelled"
            ids["negative_qty"].append(order_id)
        elif defect < 0.020:  # missing customer
            customer = ""
        elif defect < 0.024:  # missing quantity, derivable from total / unit
            qty = ""
        elif defect < 0.026:  # all three financial fields absent
            qty, unit_s, total_s = "", "", ""

        row = [order_id, date, customer, region, product, qty, unit_s, total_s, status]
        rows.append(row)

        # A double import duplicates whole rows.
        if rng.random() < 0.005 and len(rows) < args.rows:
            copy = list(row)
            rows.append(copy)
            ids["exact_duplicates"].append(order_id)
        # A near-duplicate under the documented contract: the SAME logical key
        # (order id), differing only cosmetically — the case a plain
        # drop_duplicates() misses.
        elif rng.random() < 0.003 and len(rows) < args.rows:
            near = list(row)
            near[3] = near[3].upper()          # region cased differently
            near[2] = f" {near[2]} " if near[2] else near[2]  # stray whitespace
            rows.append(near)
            ids["near_duplicates"].append(order_id)

    out = ROOT / "data" / "samples" / "sales_export_large.csv"
    with out.open("w", newline="") as fh:
        w = csv.writer(fh, quoting=csv.QUOTE_MINIMAL)
        w.writerow(["order_id", "order_date", "customer", "region", "product", "qty", "unit_price", "total", "status"])
        for r in rows:
            w.writerow(r)

    counts = tally(rows)
    manifest = {
        "generator": "scripts/make_large_corpus.py",
        "seed": args.seed,
        "file": "data/samples/sales_export_large.csv",
        "planted": counts,
        "ids": {k: v[:20] for k, v in ids.items()},
        "note": "Ground truth for scoring a profiling run. Counts are derived "
                "from the rows actually written, not from plant-time bookkeeping, "
                "so the manifest cannot disagree with the file it describes. "
                "'ids' lists the first 20 of each class for spot-checking.",
    }
    (ROOT / "data" / "samples" / "large_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote {out} ({counts['rows_written']} rows)")
    for k, v in counts.items():
        print(f"  {k:24} {v}")


if __name__ == "__main__":
    main()
