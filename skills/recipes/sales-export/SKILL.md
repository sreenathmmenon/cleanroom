---
name: recipe-sales-export
description: Standing cleaning policy for sales export CSVs (schema d97e251524eb). Auto-applies the fixes a human confirmed on run 01m16gcpa4tyfvm1v87j97gezp; pauses for schema changes, unseen categories, or anything outside this recipe. Learned 2026-08-29, delivered on branch cleanroom/recipe-sales-export.
---

# Cleaning recipe: sales export

Derived from the run that produced
[PR #4](https://github.com/sreenathmmenon/cleanroom/pull/4) — the cleaned file
and its 86-line change report. Every policy below is something the user
confirmed on that run.

## 1. Recognition

- Schema signature: `d97e251524eb476fc06def2aea3e53c138d31b1409d7a2b28ba614bc41b0b83f`
- Derivation (reproducible): for each column in file order, trim and lowercase
  the name and collapse internal whitespace; pair it with a logical dtype from
  `integer | decimal | date | boolean | string`; join as `name:dtype`, join pairs
  with a newline, encode UTF-8, SHA-256.
- Columns (9): `order_id:integer`, `order_date:date`, `customer:string`,
  `region:string`, `product:string`, `qty:integer`, `unit_price:decimal`,
  `total:decimal`, `status:string`
- If the incoming file does not match this signature exactly: **stop.** Do not
  apply this recipe. Report which column changed and run a first-run CLARIFY for
  the differences.

## 2. Confirmed policies (apply without asking)

- **Dates** — parse slash dates as day-first and emit ISO `YYYY-MM-DD`; parse
  `%b %d %Y` text dates the same way. Confirmed by user, run
  `01m16gcpa4tyfvm1v87j97gezp`, 2026-08-29; evidence: 4 rows had a first
  component greater than 12 and none had a second component greater than 12.
  **This policy is conditional**: re-verify the evidence on each run. If a future
  file contains contradicting evidence, the inference does not hold — stop and ask.
- **Exact duplicates** — drop rows identical across all 9 columns, keeping the
  first occurrence. Destructive. Confirmed by user, run
  `01m16gcpa4tyfvm1v87j97gezp`, 2026-08-29.
- **Currency and numeric text** — strip currency symbols, thousands separators
  and `USD` suffixes; preserve sign; serialize money to two decimals. Confirmed
  by user, run `01m16gcpa4tyfvm1v87j97gezp`, 2026-08-29.
- **Region canon map** — `nyc`, `n-y-c`, `New York` → `NYC`; `west` → `West`;
  `East` unchanged. Confirmed by user, run `01m16gcpa4tyfvm1v87j97gezp`,
  2026-08-29. The `New York` → `NYC` merge was flagged ambiguous by the
  canonicalization subagent (city or state) and resolved by the user, not inferred.
- **Status canon** — lowercase all status labels; `cancelled` unchanged.
  Confirmed by user, run `01m16gcpa4tyfvm1v87j97gezp`, 2026-08-29.
- **Computed totals** — where `qty` and `unit_price` are both present, trust
  `qty × unit_price` and correct `total`. Where exactly one financial field is
  missing and the other two determine it, derive it. Confirmed by user, run
  `01m16gcpa4tyfvm1v87j97gezp`, 2026-08-29.
- **Nulls** — do not impute and do not drop. A missing `customer` stays missing;
  a row with no derivable financial fields stays as it is, and is listed in the
  change report as unresolved. Confirmed by user, run
  `01m16gcpa4tyfvm1v87j97gezp`, 2026-08-29.
- **Negative quantities** — a negative `qty` on a `cancelled` order is a signed
  adjustment, not an error: keep it, provided its arithmetic is internally
  consistent. Confirmed by user, run `01m16gcpa4tyfvm1v87j97gezp`, 2026-08-29.

## 3. Fix pipeline (exact order)

1. Drop exact duplicate rows — **destructive** — max rows affected: 2
2. Normalize dates to ISO — safe — max rows affected: 13
3. Normalize currency and numeric text — safe — max rows affected: 39
4. Apply region canon map — safe — max rows affected: 16
5. Apply status canon — safe — max rows affected: 14
6. Repair computed totals and derive determinable fields — **destructive** — max rows affected: 3

This is the order that passed verification on the creating run. Do not reorder:
deduplication precedes normalization so that row counts reconcile against the
input, and totals are repaired after the numeric columns are typed.

## 4. Verification assertions (all must pass)

- Row reconciliation: input rows − dropped = output rows.
- Unique, non-null `order_id` across all output rows.
- Zero exact duplicates remain.
- All dates parse and are ISO-formatted; zero future dates.
- `qty`, `unit_price`, `total` are numeric; the CSV round-trips.
- For every row where all three are present: `|total − qty × unit_price| < 0.01`.
- Residual nulls do not exceed the recorded ceiling (§5).
- Idempotence: running the pipeline on its own output changes 0 rows.

On any failure: stop, report, do not deliver.

## 5. Escalation rules (always pause and ask)

- Schema signature mismatch (see §1).
- A `region` or `status` value not present in the §2 canon maps — including a
  new spelling of a known value.
- Row count outside **42 ± 20%** (34 to 50 rows). A larger export is not
  necessarily wrong, but it is not what this recipe was measured against.
- Null rate above the recorded ceiling: `customer` 7.5%, `qty` 5%,
  `unit_price` 2.5%, `total` 2.5%; any null in `order_id`, `order_date`,
  `region`, `product`, or `status`.
- Any step affecting more than 1.5× its §3 maximum.
- Contradicting day-first evidence in slash dates (see §2).
- A negative quantity on an order whose status is not `cancelled`.
- Any §4 assertion failure.
- **Anything this recipe is silent on.**

## 6. Open questions (not policy — ask if encountered)

- Near-duplicate rows that share a logical key but differ cosmetically. Run 1
  found one such pair (orders 1004 and 1005, identical except `order_id`) and
  the user chose to keep both. That was a decision about those two rows, not a
  stated rule, so a future near-duplicate is a question, not a precedent.
- Whether `New York` should ever mean the state rather than the city. The
  creating run merged it into `NYC` for that file; a dataset that distinguishes
  them would need a different map.

## 7. Provenance

- Created 2026-08-29 from run `01m16gcpa4tyfvm1v87j97gezp`; source file
  SHA-256 `fcf0b349e9d018cab485bf01d7136d0fead925cc855417731c72e42df6446b45`.
- Delivered on branch `cleanroom/recipe-sales-export`; review and merge pending.
- Supersedes: none.
