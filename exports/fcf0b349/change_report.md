# Cleanroom change report: sales_export_messy.csv

## Provenance

- Source SHA-256: `fcf0b349e9d018cab485bf01d7136d0fead925cc855417731c72e42df6446b45`
- Recipe: `recipe-sales-export` (confirmed policies from run `01m16gcpa4tyfvm1v87j97gezp`, 2026-08-29)
- Recipe resolution: raw-URL fallback; exact schema signature and source hash match
- Original file was not modified.

## Applied fixes

### 1. Exact duplicate removal — destructive
- Changed: 2 rows dropped; second occurrences only.
- Rule: identical across all 9 columns, keep first.
- References: CSV line 9 / order 1007 → dropped; CSV line 24 / order 1021 → dropped.
- Post-condition: 0 exact duplicates; unique, non-null `order_id`.

### 2. Date normalization — safe
- Changed: 13 rows.
- Rule: proven day-first slash and text dates → ISO `YYYY-MM-DD`.
- Examples: 1002 `04/03/2026` → `2026-03-04`; 1003 `Mar 6 2026` → `2026-03-06`; 1009 `15/03/2026` → `2026-03-15`.
- Post-condition: all dates parse as ISO; 0 future dates.

### 3. Currency/numeric normalization — safe
- Changed: 39 rows / 78 money cells.
- Rule: strip currency syntax and separators, preserve sign, serialize money to 2 decimals.
- Examples: `$1,234.50` → `1234.50`; `2,150.00 USD` → `2150.00`; `-$2,469.00` → `-2469.00`.
- Post-condition: numeric dtypes and successful CSV round-trip.

### 4. Region canonicalization — safe
- Changed: 16 rows after deduplication.
- Rule: `nyc`, `n-y-c`, `New York` → `NYC`; `west` → `West`.
- Examples: order 1001 `nyc` → `NYC`; 1002 `New York` → `NYC`; 1003 `n-y-c` → `NYC`.
- Post-condition: only `NYC`, `West`, `East`.

### 5. Status canonicalization — safe
- Changed: 14 rows after deduplication.
- Rule: lowercase all status labels.
- Examples: order 1002 `SHIPPED` → `shipped`; 1003 `Shipped` → `shipped`; 1011 `Pending` → `pending`.
- Post-condition: only `shipped`, `pending`, `cancelled`.

### 6. Financial repair/derivation — destructive overwrite
- Changed: 3 rows.
- Rule: trust `qty × unit_price`; derive a sole missing financial field when determinable.
- Examples: order 1009 total `4500.00` → `4300.00`; 1036 total `4730.00` → `4300.00`; 1020 qty null → `10`.
- Post-condition: all 39 complete financial rows have absolute arithmetic error < 0.01.

## Verification

| Assertion | Result |
|---|---|
| Row reconciliation: 42 − 2 = 40 | PASS |
| Unique, non-null order IDs | PASS |
| Exact duplicates remaining | PASS — 0 |
| Dates parse as ISO; future dates | PASS — 40/40; 0 future |
| Numeric dtype and CSV round-trip | PASS |
| Complete financial rows consistent | PASS — 39/39 |
| Null ceilings | PASS |
| Idempotence | PASS — rerun changes 0 rows |

## Reconciliation

| Metric | Count |
|---|---:|
| Rows in | 42 |
| Approved rows dropped | 2 |
| Retained rows changed | 40 |
| Rows out | 40 |

## Intentionally unchanged / unresolved

- Orders 1004 and 1005 remain distinct by explicit user decision.
- Missing customer remains on orders 1008, 1017, and 1033.
- Order 1013 retains null `qty`, `unit_price`, and `total`; no derivation is possible.
- Order 1010 retains negative qty `-2` as a consistent cancelled-order adjustment.
