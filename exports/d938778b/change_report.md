# Cleanroom Change Report

## Source and reconciliation

- Original file: `sales_export_messy.csv`
- Source SHA-256: `fcf0b349e9d018cab485bf01d7136d0fead925cc855417731c72e42df6446b45`
- Input: 42 rows, 9 columns
- Output: 40 rows, 9 columns
- Approved drops: 2 rows
- Reconciliation: `42 - 2 = 40`
- Original sandbox copy unchanged: yes

## Changes applied

### 1. Exact duplicate removal — destructive

- **Count:** 2 rows dropped.
- **Rule:** keep the first occurrence of a row identical across all 9 columns.
- **Rows:** order 1007 — kept CSV row 8, dropped row 9; order 1021 — kept CSV row 23, dropped row 24.
- Only two duplicate groups existed, so both examples are shown.

### 2. Date normalization — safe

- **Count:** 13 surviving rows changed.
- **Rule:** parse slash dates as DMY (four first components exceeded 12; no second component did), parse supported month-name dates, and emit `YYYY-MM-DD`.
- **Examples:**
  - order 1002: `04/03/2026` → `2026-03-04`
  - order 1003: `Mar 6 2026` → `2026-03-06`
  - order 1009: `15/03/2026` → `2026-03-15`

### 3. Numeric and currency normalization — safe

- **Count:** 39 surviving rows; 116 non-null cells typed/normalized (38 `qty`, 39 `unit_price`, 39 `total`).
- **Rule:** remove supported currency signs, thousands separators, `USD` suffixes, and negative notation; serialize money with two decimal places.
- **Examples:**
  - order 1001 `unit_price`: `$1,234.50` → `1234.50`
  - order 1001 `total`: `$3,703.50` → `3703.50`
  - order 1010 `total`: `-$2,469.00` → `-2469.00`

### 4. Region canonicalization — safe

- **Count:** 16 surviving rows changed.
- **Rule:** `nyc`, `n-y-c`, and `New York` → `NYC`; `west` → `West`.
- **Examples:**
  - order 1001: `nyc` → `NYC`
  - order 1002: `New York` → `NYC`
  - order 1003: `n-y-c` → `NYC`

### 5. Status canonicalization — safe

- **Count:** 14 surviving rows changed.
- **Rule:** lowercase status labels.
- **Examples:**
  - order 1002: `SHIPPED` → `shipped`
  - order 1003: `Shipped` → `shipped`
  - order 1011: `Pending` → `pending`

### 6. Arithmetic repair — destructive

- **Count:** 3 rows overwritten or filled.
- **Rule:** derive a missing field when the other two financial fields determine it; otherwise trust `qty × unit_price` for the approved total corrections.
- **Examples (all affected rows):**
  - order 1020 `qty`: null → `10` (`899.90 / 89.99`)
  - order 1009 `total`: `4500.00` → `4300.00` (`2 × 2150.00`)
  - order 1036 `total`: `4730.00` → `4300.00` (`2 × 2150.00`)

## Intentional unresolved values and exceptions

- `customer` remains null for orders 1008, 1017, and 1033; no evidence-based imputation exists.
- `qty`, `unit_price`, and `total` remain null for order 1013; no value is derivable.
- Order 1010 remains a signed cancelled adjustment: `qty=-2`, `total=-2469.00`; its arithmetic is consistent.

## Verification

| Check | Result |
|---|---|
| Row reconciliation | PASS — 42 − 2 = 40 |
| Unique, non-null order IDs | PASS — 40 of 40 |
| Exact duplicates | PASS — 0 |
| Numeric dtypes and CSV round-trip | PASS |
| Residual nulls | PASS — customer 3; qty 1; unit_price 1; total 1; all others 0 |
| ISO and parseable dates | PASS — 40 of 40 |
| Future dates as of 2026-08-29 | PASS — 0 |
| Complete-row computed totals | PASS — 0 mismatches |
| Signed order 1010 preserved | PASS |
| Idempotence | PASS — second run produced no changes |
