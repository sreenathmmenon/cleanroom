---
name: data-cleaning
description: Methodology for profiling and repairing messy tabular data (CSV/Excel) with pandas inside a sandbox — profiling checklist, fix catalog with pandas patterns, verification rules, and safety constraints. Use when the user provides a dataset that needs cleaning, validation, or normalization.
---

# Data Cleaning Skill

Work on a **copy** in the sandbox. Profile before proposing. Verify after applying.
Label every destructive step. The methodology below is the required order of
operations; skip only what genuinely does not apply, and say why.

## 1. Profiling checklist

Run these as one script; print every metric. Each output number becomes a finding
or a clean bill of health.

- **Shape**: rows × columns; column names (flag duplicates, whitespace, mixed case)
- **Types**: inferred dtype per column; flag `object` columns that are mostly
  numeric/date (mixed-format signal)
- **Nulls**: count + share per column; flag columns > 50% null; flag rows that are
  fully null
- **Duplicates**: exact duplicate rows; near-duplicates on the logical key
  (same id/date/amount with cosmetic differences)
- **Dates**: for each candidate column, test parseability under ISO (`%Y-%m-%d`),
  text (`%b %d %Y`, `%d %b %Y`), and slash formats. For slash values, infer
  day-first vs month-first **from unambiguous rows** (a component > 12 proves its
  side); report the inference, its evidence, and any residual ambiguity
- **Numbers-as-text**: currency symbols, thousands separators, unit suffixes
  ("1.2k", "3,400.00 USD"), parentheses negatives "(450.00)"
- **Categories**: distinct values per low-cardinality column; flag variants that
  canonicalize to one entity ("NYC"/"New York"/"n-y-c")
- **Integrity**: computed columns that should equal expressions of others
  (`qty × unit_price ≈ total`); referential checks (foreign keys, orphan ids)
- **Outliers**: numeric columns beyond p1/p99 or negative where the domain
  forbids it (negative quantities, future ship dates)

## 2. Fix catalog

| Issue | Fix | Destructive? | Needs clarification? |
|---|---|---|---|
| Mixed date formats | Parse per-subset with explicit `format`, combine | No | Yes — ambiguous `03/04` |
| Currency-as-text | Regex strip symbols/separators → decimal | No | Rarely |
| Exact duplicates | `df.drop_duplicates()` | **Yes** (row drop) | Key choice if partial |
| Near-duplicates | Keep canonical row by rule (latest, most complete) | **Yes** | Yes — which rule |
| Category variants | Map to canonical form via explicit dict | No | Yes — merge decisions |
| Nulls in required col | Drop rows vs impute vs leave | **Yes** if drop | **Always** |
| Wrong computed totals | Recompute from source columns | No (in sandbox copy) | Show affected rows |
| Negative impossible values | Flip sign if clearly entry error, else flag | **Yes** | Yes |
| Whitespace/case in keys | `str.strip().str.lower()` on copy | No | No |

Rules of engagement for fixes:

- Every mapping dict (categories, dedup keys) is shown to the user before use.
- Never drop a row without stating how many, which ones (ids), and why.
- Imputation only with an explicit policy the user chose (zero/median/interpolate).
- Preserve the original column order; add no helper columns to the export.

## 3. Pandas patterns

```python
# Mixed dates: INFER the slash-order from unambiguous rows, never guess it.
# Evidence rule: in 29/03/2026 the 29 cannot be a month → day-first is proven.
# If evidence is missing or contradictory, return None and ASK the user.
def infer_slash_format(values):
    day_first = sum(1 for v in values if int(v.split("/")[0]) > 12)
    month_first = sum(1 for v in values if int(v.split("/")[1]) > 12)
    if day_first and not month_first:
        return "%d/%m/%Y"
    if month_first and not day_first:
        return "%m/%d/%Y"
    return None  # ambiguous or mixed → must be clarified with the user

def parse_dates(s):
    out = pd.to_datetime(s, format="%Y-%m-%d", errors="coerce")            # ISO
    for fmt in ("%b %d %Y", "%d %b %Y"):                                    # Mar 6 2026 / 6 Mar 2026
        mask = out.isna()
        out[mask] = pd.to_datetime(s[mask], format=fmt, errors="coerce")
    slash_mask = s.astype(str).str.fullmatch(r"\d{1,2}/\d{1,2}/\d{4}").fillna(False)
    fmt = infer_slash_format(s[slash_mask]) if slash_mask.any() else None
    if fmt:
        out[slash_mask] = pd.to_datetime(s[slash_mask], format=fmt, errors="coerce")
    return out, fmt  # fmt is None → report the ambiguity; do not pick silently

# Currency text → numeric
money = (
    raw.str.replace(r"[^\d.\-()]", "", regex=True)
       .str.replace(r"\((.*)\)", r"-\1", regex=True)
       .astype(float)
)

# Near-duplicate canonicalization: most complete row per key
completeness = df.notna().sum(axis=1)
canonical = (df.assign(_c=completeness)
               .sort_values("_c").groupby(key_cols, as_index=False).tail(1))
```

## 4. Verification suite (mandatory after APPLY)

```python
assert len(before) - len(after) == approved_drops, "row count must reconcile"
assert after["order_date"].isna().sum() == 0, "post-condition: no null dates"
assert (after["total"] - after["qty"] * after["unit_price"]).abs().max() < 0.01
assert parse_dates(after["order_date"]).notna().all(), "all dates parse"
rerun = pipeline(after); assert rerun.equals(after), "pipeline must be idempotent"
```

Every assertion has a named post-condition from the approved plan. A failed
assertion is a halt-and-report, never a silent patch.

## 5. Change report format

`change_report.md` lists, per fix: what changed, how many rows, the rule applied,
and 3 example before→after rows. Ends with a reconciliation table:
rows in / dropped / changed / rows out, and any unresolved issues with reasons.
