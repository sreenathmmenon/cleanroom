# Real money — 6,000 rows of NYC payroll, nothing planted

Cleanroom's promise is data you can trust, and its demo corpus is a sales export
— but that file's money defects were planted by the same person who wrote the
arithmetic checks. The [NYC 311 run](real-world-run.md) proved the agent handles
unfamiliar real data; it contains no money at all.

This closes that gap: a deterministic 6,000-row slice of
[NYC Citywide Payroll Data](https://data.cityofnewyork.us/City-Government/Citywide-Payroll-Data-Fiscal-Year-/k397-673e)
(CC0, retrieved 2026-08-29), 70 agencies across 12 fiscal years. Real money, real
payroll pathology, and the agent was told nothing about what was wrong with it.

Employee names are replaced with stable pseudonymous ids. Every financial,
temporal and categorical field — the data being cleaned — is unmodified.

- Corpus: `data/samples/nyc_payroll_messy.csv` — 6,000 × 17
- Agent fingerprint: SHA-256 `fa81f5f60b2201097b2ab5e1fc785bb2…`
- Session `01m17xm1abdhtdw2zqf2xxwe41`, turn `01m17xm1ar93hg1yfrhzdc6xhq`

## Scored against the independent reference

| Check | Reference | Agent | |
|---|---:|---:|---|
| **Overtime pay with zero overtime hours** | **1,068** | **1,068** | exact |
| Overtime hours with zero overtime pay | 6 | 6 | exact |
| Negative `regular_gross_paid` | 114 | 114 | exact |
| Negative `total_other_pay` | 123 | 123 | exact |
| Negative `regular_hours` | 36 | 36 | exact |
| Negative `ot_hours` | 12 | 12 | exact |
| Agency case-variant rows | 293 | 293 | exact |
| Exact duplicate rows | 0 | 0 | exact |
| Missing `work_location_borough` | 657 | 657 | exact |

**Nine of nine, exact.** `npm run score:payroll` recomputes every value from the
corpus and compares it with the figure the agent reported, exiting non-zero on any
mismatch. Including the shape and the six extra findings below it scores **16 of 16**.

### Six more it found that the reference never thought to measure

Independently verified after the fact, all exact:

| Finding | Agent | Verified |
|---|---:|---:|
| `mid_init` entirely empty | 6,000 | 6,000 |
| Regular pay above zero with **zero regular hours** | 3,014 | 3,014 |
| `payroll_number` missing | 1,893 | 1,893 |
| Borough case-variant rows | 19 | 19 |
| Rows with **any** negative pay or hours | 223 | 223 |
| Repeated employee-year key groups | 228 rows / 112 groups | 228 / 112 |

Two of its *pattern* claims were checked too, and both hold: missing payroll
numbers are "concentrated in 2014–2017" (they are: 320/567/510/496, and nothing
outside), and the 657 missing boroughs "all occur in 2014" (they do).

## It refused to do arithmetic it could not justify

This is the result that matters on financial data. The obvious "fix" for 762
per-hour rows where `regular_gross_paid ≠ base_salary × regular_hours` is to
recompute the total — exactly what the agent does on the sales corpus, where
`qty × unit_price = total` genuinely holds.

It declined:

> Per-hour `regular_gross ≠ base_salary × hours` by >$1 — **762/864** — often
> includes poll workers with a placeholder `$1` rate and zero hours;
> **recomputation would corrupt pay**

> Near-full-year annual regular pay differs >10% from base — 161 — **base rate is
> not a reliable gross-pay formula**

> **Derived cash:** `regular + OT + other` ranges from −$37,871.76 to
> $403,109.75; **there is no stored total column against which to assert
> equality**

That last line is the whole distinction. On the sales corpus a stored `total`
column exists and must equal `qty × unit_price`, so a mismatch is an error. Here
no such column exists, `base_salary` is a *rate* rather than an expected total,
and gross pay legitimately reflects partial periods and mid-year rate changes.
An agent that "reconciles" this dataset silently rewrites people's pay.

It reached the same conclusion about the 1,068 overtime-pay-without-hours rows
("no defensible hours imputation") and the 223 negative rows ("includes payroll
adjustments" — clawbacks are real payroll, not corruption).

## Five questions, all recommending preservation

| Question | Recommended option |
|---|---|
| How to handle pay/hour anomalies (governs 223 negatives, 1,068 OT rows, 79 negative totals) | **Preserve all source values and rows; document every integrity flag without claiming the amounts are repaired** |
| The 228 rows in 112 repeated employee-year groups | **Retain all 228; treat the candidate key as non-unique** — samples show separate titles or pay bases for the same employee-year |
| Which categorical normalization | **Only the unambiguous case variants: 293 agency rows, 19 borough rows; keep all DA labels distinct** |
| Structural nulls (all-null `mid_init`, 1,893 payroll numbers, 657 boroughs) | **Preserve all columns, rows and nulls; document their year-specific structural pattern** |
| Export representation of dates | Normalize to `YYYY-MM-DD`, dropping the redundant midnight time |

Every alternative that drops rows or overwrites amounts is offered — and none is
recommended. The one destructive option in the first question ("overwrite the 762
per-hour mismatches using `base_salary × regular_hours`") is precisely the fix a
naive cleaner would apply by default.

## Delegation, and an ambiguity it would not resolve

The category review was delegated to a subagent (`thread.created` /
`thread.done` on its own thread). It confirmed the 293 agency and 19 borough
case mappings, and flagged the District Attorney long/short labels as **genuinely
ambiguous** — so merging 26 short DA labels became an option for the user rather
than a decision by the agent.

## Event ledger


| # | t | event | thread |
|---:|---:|---|---|
| 1 | +0.0s | `turn.created` | — |
| 2 | +4.5s | `model.message` | main |
| 3 | +13.7s | `sandbox.created` | — |
| 4 | +13.7s | `tool.response` | main |
| 5 | +18.3s | `model.message` | main |
| 6 | +21.1s | `tool.response` | main |
| 7 | +22.8s | `model.message` | main |
| 8 | +22.9s | `tool.response` | main |
| 9 | +32.2s | `model.message` | main |
| 10 | +32.2s | `tool.response` | main |
| 11 | +86.5s | `model.message` | main |
| 12 | +86.7s | `tool.response` | main |
| 13 | +90.0s | `model.message` | main |
| 14 | +108.2s | `tool.response` | main |
| 15 | +111.6s | `model.message` | main |
| 16 | +112.0s | `tool.response` | main |
| 17 | +121.4s | `model.message` | main |
| 18 | +121.4s | `thread.created` | sub:0211836c |
| 19 | +128.3s | `model.message` | sub:0211836c |
| 20 | +128.3s | `tool.response` | main |
| 21 | +128.3s | `thread.done` | sub:0211836c |
| 22 | +151.8s | `model.message` | main |
| 23 | +153.2s | `tool.response` | main |
| 24 | +156.2s | `model.message` | main |
| 25 | +156.7s | `tool.response` | main |
| 26 | +184.4s | `model.message` | main |
| 27 | +184.4s | `tool.response_required` | main |
| 28 | +184.4s | `turn.done` | — |

Total 28 events over +184.4s.


The turn ends on `tool.response_required` carrying five pending calls. On 6,000
rows of real payroll, the agent measured everything, refused every repair it
could not justify from the data, and stopped for a person.

## Reproducing this

```bash
npm run score:payroll   # recomputes the reference and compares, exits non-zero on mismatch
```
