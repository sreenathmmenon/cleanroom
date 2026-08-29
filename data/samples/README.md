# Sample corpora

| File | Rows × cols | Origin | What it is for |
|---|---|---|---|
| `sales_export_messy.csv` | 42 × 9 | Hand-built | The demo corpus: every defect is planted and verifiable by hand |
| `sales_export_messy_week2.csv` | 15 × 9 | Hand-built | Act two: same schema, one category the recipe has never seen |
| `sales_export_large.csv` | 10,000 × 9 | Generated (seed 20260830) | Scale, scored against `large_manifest.json` |
| `nyc311_service_requests.csv` | 5,000 × 44 | **Real** — NYC OpenData | Data nobody designed for this agent |
| `nyc_payroll_messy.csv` | 6,000 × 17 | **Real** — NYC OpenData | Real money: cross-column payroll integrity |
| `tests/week2_renamed_column.csv` | 15 × 9 | Hand-built | Proves a refusal, not a repair |

## Why a real dataset is here

The first three corpora share a weakness: I built them, so they can only contain
defects I already knew how to plant. A profiling run against them measures
recall against my own imagination.

`nyc311_service_requests.csv` is a deterministic 5,000-row slice of
[NYC 311 Service Requests](https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9)
(CC0, public domain), retrieved 2026-08-29. Forty-four columns of real municipal
data: **ten** columns at least 95% missing once sentinel strings are counted as
missing alongside empty cells (nine by empty cells alone — `park_facility_name`
is never empty and always `Unspecified`), `closed_date` missing on 56% of rows,
`Unspecified` used as a null sentinel, 45 distinct city spellings — and 32
tickets closed *before* they were created, an integrity violation no synthetic
corpus here models.

`nyc311_reference.json` records what an independent script measures in that
file. It is a **reference, not a manifest**: nothing was planted, so it scores
the agent against reality rather than against a generator.

The slice is deterministic — every row with a temporal violation is retained,
then the file is filled in source order and sorted by `unique_key` — so the
findings are the same on every run.

## Why a real *financial* dataset is here too

The NYC 311 corpus proved the agent handles unfamiliar real data, but it has no
money in it — and the sales corpus's money defects were planted by the same
person who wrote the arithmetic checks.

`nyc_payroll_messy.csv` is a deterministic 6,000-row slice of
[NYC Citywide Payroll Data](https://data.cityofnewyork.us/City-Government/Citywide-Payroll-Data-Fiscal-Year-/k397-673e)
(CC0, retrieved 2026-08-29), 70 agencies across 12 fiscal years. Real payroll
pathology: 1,068 rows paid overtime with zero overtime hours, 3,014 with regular
pay and zero regular hours, 223 rows carrying negative pay or hours, agency and
job-title case variants (including a genuine typo, `PARAMEDIc`), and 657 rows
with no work borough.

**Privacy:** the source publishes employee names; this slice replaces them with
stable pseudonymous ids. Every financial, temporal and categorical field — the
data actually being cleaned — is unmodified.

`nyc_payroll_reference.json` is what an independent script measures there, and
`npm run score:payroll` compares it with what the agent reported: a reference,
not a manifest, since nothing was planted.
