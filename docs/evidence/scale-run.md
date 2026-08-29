# Scale run — 10,000 rows, scored against ground truth

The 42-row demo corpus exists so a reader can verify every number by hand. What
it cannot answer is whether the profiling holds up at size — or whether the
numbers are still real when nobody can count them manually.

So the large corpus ships with a manifest. `scripts/make_large_corpus.py` counts
every issue **as it plants it** and writes those counts to
`data/samples/large_manifest.json`. A profiling run can then be scored against
ground truth instead of taken on faith.

- Corpus: `data/samples/sales_export_large.csv` — 10,000 rows × 9 columns, 783 KB
- Generator seed `20260830`; the file is byte-identical on every run
- SHA-256 `c147ef8661baeaa662bd16293ca5e7e40c2625e5d80824c935330a6b002dc39b`
- Session `01m179qj51f9td75p4kajgvcwm`, turn `01m179qj5ns2h01ejbzdyg6z5m`
- PROFILE + CLARIFY completed in **about three minutes**

The agent's own fingerprint of its sandbox copy — 10,000 rows, 801,757 bytes,
and the same SHA-256 — matches the generator's output exactly.

## Detection vs. ground truth

Every "found" number below is from the agent's PROFILE summary; every "planted"
number was written when the file was generated.

| Issue class | Planted | Found | |
|---|---:|---:|---|
| Exact duplicate rows (excess copies) | 41 | 41 | exact |
| Slash dates (day-first) | 2,002 | 2,002 | exact |
| Text dates (`%b %d %Y`) | 1,009 | 1,009 | exact |
| Totals that do not reconcile | 68 | 68 | exact |
| Null `customer` | 68 | 68 | exact |
| Null `qty` | 41 | 41 | exact |
| Null `unit_price` | 11 | 11 | exact |
| Null `total` | 11 | 11 | exact |
| Negative quantity | 23 | 23 | exact |
| `USD` suffix in `unit_price` | 27 | 27 | exact |

**Ten of ten planted classes detected exactly.**

Two classes deserve a sentence rather than a tick:

- **Region variants: 4,114 planted.** The agent reported 3,309 rows it would
  canonicalize, plus 805 rows it refused to canonicalize without asking —
  `New York`, which may be the city or the state. 3,309 + 805 = 4,114. It found
  every one; it declined to *decide* 805 of them.
- **Status variants: 5,779 by the manifest's definition, 5,896 by the agent's.**
  The manifest treats lowercase `shipped`/`pending` as canonical; the agent
  proposed Title case, which makes `shipped` a change too. The same rows are
  involved either way — the difference is which spelling is the target, and that
  is exactly the choice the agent puts to the user instead of settling itself.

No false positives. The agent reported zero near-duplicate conflicts, zero
unparseable or future dates, zero unparseable numerics, and zero parentheses
negatives — and the generator planted none of those.

## Date inference does not weaken with volume

> Slash-date order is supported by **2,002 day-first proofs and zero opposing
> cases**.

Every slash date in the corpus carries a day component greater than 12, so
day-first is proven rather than assumed — and the agent reported the count
rather than the conclusion alone.

## Context management: detail went to files, not the conversation

A full profile of 10,000 rows would bury a chat window. The agent wrote the
detail to sandbox files and brought back only the summary table:

```
outputs/profile_sales_export_large/PROFILE_REPORT.md
outputs/profile_sales_export_large/summary_issue_counts.csv
outputs/profile_sales_export_large/findings.csv
outputs/profile_sales_export_large/affected_rows.csv
outputs/profile_sales_export_large/fingerprint.json
outputs/profile_sales_export_large/category_canonicalization_analysis.json
outputs/profile_sales_export_large_bundle.zip
```

The per-row detail in `affected_rows.csv` stays retrievable and downloadable
without ever entering the model's context.

## Delegation held at scale

The turn's events show the same subagent pattern as the small corpus — a
`thread.created` / `thread.done` pair on a thread of its own. With four
low-cardinality columns in play, the root agent delegated and received back a
compact result:

```json
{
  "canonical_maps": {
    "customer": {}, "product": {},
    "region": { "west": "West", "n-y-c": "NYC", "nyc": "NYC" },
    "status": { "pending": "Pending", "SHIPPED": "Shipped", "shipped": "Shipped" }
  },
  "changed_row_counts": { "customer": 0, "region": 3309, "product": 0, "status": 5896 },
  "ambiguous_variants": {
    "region": [{
      "value": "New York", "row_count": 805,
      "clarification_needed": "Could mean NYC or a distinct New York state/region category; do not merge without confirmation."
    }]
  }
}
```

The subagent also reported that `customer` and `product` needed no
canonicalization at all — empty maps, a measured negative result.

## How the run ended

It stopped and asked. The turn terminates on `tool.response_required`: 805 rows
of `New York` are not a question the agent will answer for you, at any scale.

## Reproducing this

```bash
python3 scripts/make_large_corpus.py   # regenerates the identical file and manifest
```

Then point a session at the corpus and compare its PROFILE counts against
`data/samples/large_manifest.json`.
