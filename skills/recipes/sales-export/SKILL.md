---
name: recipe-sales-export
description: Standing cleaning policy for sales export CSVs (schema d97e251524eb). Auto-applies confirmed fixes; pauses for anything outside this recipe. Updated 2026-08-30 from run fcf0b349; delivery branch cleanroom/recipe-sales-export.
---

# Cleaning recipe: sales export

## 1. Recognition

- Schema signature: `d97e251524eb476fc06def2aea3e53c138d31b1409d7a2b28ba614bc41b0b83f`
- Derivation: for each column in file order, strip leading and trailing whitespace, lowercase it, and collapse internal whitespace runs to one space; pair it with a logical dtype from `integer | decimal | date | boolean | string`; join each pair as `name:dtype`, join pairs with `\n` and no trailing newline, encode UTF-8, and SHA-256 the bytes.
- Columns (9), in order: `order_id:integer`, `order_date:date`, `customer:string`, `region:string`, `product:string`, `qty:integer`, `unit_price:decimal`, `total:decimal`, `status:string`.
- If the incoming schema does not match exactly: **STOP**. Report the changed column(s) and run first-run CLARIFY.

## 2. Confirmed policies (apply without asking)

- **Dates:** parse slash dates as day-first only when the incoming evidence remains non-contradictory, parse `%b %d %Y`, and emit ISO `YYYY-MM-DD`. Confirmed by user through approval of plan step 2, run `fcf0b349`, 2026-08-30; evidence: 4 rows had a first component >12 and 0 had a second component >12.
- **Exact duplicates:** drop rows identical across all 9 columns, keeping the first occurrence. Confirmed by user through approval of destructive plan step 1, run `fcf0b349`, 2026-08-30.
- **Specific near-duplicate pair:** keep orders `1004` and `1005` as distinct records even when every non-ID field matches. Confirmed by direct clarification, run `fcf0b349`, 2026-08-30. This is pair-specific, not a general near-duplicate rule.
- **Currency and numeric text:** strip currency symbols, thousands separators, and `USD`; preserve sign; serialize money to two decimals. Confirmed by user through approval of plan step 3, run `fcf0b349`, 2026-08-30.
- **Region canon map:** `NYC`→`NYC`, `nyc`→`NYC`, `n-y-c`→`NYC`, `New York`→`NYC`, `West`→`West`, `west`→`West`, `East`→`East`. Confirmed by user through approval of plan step 4, run `fcf0b349`, 2026-08-30. The semantically ambiguous `New York`→`NYC` merge was explicitly approved, not inferred.
- **Status canon map:** `shipped`, `SHIPPED`, `Shipped`→`shipped`; `pending`, `Pending`→`pending`; `cancelled`→`cancelled`. Confirmed by user through approval of plan step 5, run `fcf0b349`, 2026-08-30.
- **Computed financials:** when `qty` and `unit_price` are present, trust `qty × unit_price` and replace a disagreeing `total`; when exactly one financial field is missing and the other two determine it, derive it. Confirmed by user through approval of destructive plan step 6, run `fcf0b349`, 2026-08-30.
- **Nulls:** preserve missing customers; preserve a row with no derivable financial values; do not impute or drop it. Confirmed by user through approval of the plan's intentionally-unchanged scope, run `fcf0b349`, 2026-08-30.
- **Negative quantities:** retain a negative `qty` only when status is `cancelled` and arithmetic is internally consistent. Confirmed by user through approval of the plan's intentionally-unchanged scope, run `fcf0b349`, 2026-08-30.

## 3. Fix pipeline (exact order)

1. Drop exact duplicate rows, keeping first — **destructive** — maximum 2 rows dropped.
2. Normalize dates to ISO — **safe** — maximum 13 rows changed.
3. Normalize currency/numeric text — **safe** — maximum 39 rows changed after deduplication.
4. Apply the region canon map — **safe** — maximum 16 rows changed after deduplication.
5. Apply the status canon map — **safe** — maximum 14 rows changed after deduplication.
6. Repair totals and derive determinable financial fields — **destructive overwrite** — maximum 3 rows changed.

This exact order passed verification on run `fcf0b349`, 2026-08-30. Do not reorder.

## 4. Verification assertions (all must pass)

- Input rows minus exactly 2 approved duplicate drops equals output rows; creating run: `42 − 2 = 40`.
- `order_id` is integer, unique, and non-null; exact duplicates remaining: 0.
- Every `order_date` parses under `%Y-%m-%d`, is ISO-formatted, and is not later than the run date.
- `qty` is nullable integer; `unit_price` and `total` are nullable decimal; numeric CSV round-trip succeeds.
- For every row with all three financial values, `|total − qty × unit_price| < 0.01`; creating run passed 39/39.
- Output null ceilings: `customer` ≤7.5%, `qty` ≤5%, `unit_price` ≤2.5%, `total` ≤2.5%; zero nulls in `order_id`, `order_date`, `region`, `product`, `status`.
- Output categories: region only `NYC | West | East`; status only `shipped | pending | cancelled`.
- Idempotence: running the pipeline on its own output changes 0 rows.

On any failure: **STOP**, report, and do not deliver.

## 5. Escalation rules (always pause and ask)

- Schema signature mismatch, including any added, removed, renamed, reordered, or logically retyped column.
- Any `region` or `status` value absent from the §2 canon maps.
- Row count outside 34–50 (creating-run baseline 42 ±20%).
- Incoming null rate above the measured ceilings: `customer` 7.15%, `qty` 4.77%, `unit_price` 2.39%, `total` 2.39%; any null in `order_id`, `order_date`, `region`, `product`, or `status`.
- Numeric profile outside creating-run bounds: `qty` −2 to 30, `unit_price` 45.00 to 2150.00, `total` −2469.00 to 11110.50; any negative `qty` on a non-`cancelled` row; or any negative financial value that is arithmetically inconsistent.
- Contradictory slash-date evidence, no evidence from which to infer order, an unparseable date, or a future date.
- Any fix step that would exceed its stated §3 maximum.
- Any near-duplicate other than the explicitly confirmed `1004`/`1005` pair.
- Any §4 assertion failure.
- Anything this recipe is silent on.

## 6. Open questions (not policy — ask if encountered)

- How to resolve any new near-duplicate pair. The `1004`/`1005` decision is not a general rule.
- Whether `New York` means city or state in a source that distinguishes them. This run approved `New York`→`NYC` only under the matching schema and category domain.

## 7. Provenance

- Updated 2026-08-30 from run `fcf0b349`; source SHA-256 `fcf0b349e9d018cab485bf01d7136d0fead925cc855417731c72e42df6446b45`.
- Delivery branch: `cleanroom/recipe-sales-export`; review and merge pending.
- Supersedes the recipe created from run `01m16gcpa4tyfvm1v87j97gezp` on 2026-08-29.
