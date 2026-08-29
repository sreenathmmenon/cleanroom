# Scale run — 10,000 rows, scored against ground truth

The 42-row demo corpus is small so a reader can verify every number by hand.
That is also its limit: it cannot show whether profiling holds up at size, or
whether the counts are still real when nobody can check them manually.

So the large corpus ships with a manifest. `scripts/make_large_corpus.py`
generates the file and then **tallies the rows it actually wrote** into
`data/samples/large_manifest.json`. Deriving ground truth from the output rather
than from plant-time bookkeeping means the manifest cannot disagree with the
file it describes — a duplicated row repeats every defect it carries, and a
mutated total can gain a thousands separator, and both are counted because both
are in the file.

- Corpus: `data/samples/sales_export_large.csv` — 10,000 rows × 9 columns
- Generator seed `20260830`; byte-identical on every run
- SHA-256 `cf94f3a1b63da81933181196baac85a513ac943501f57a1e79d67a0aa5ee2f1f`
- Session `01m17afdcvdb5rpzprfvr0kkn9`, turn `01m17afdd9cznrg9ara0t5gmy3`
- PROFILE + CLARIFY in **152 seconds**

The agent's own fingerprint of its sandbox copy — 10,000 rows, 801,813 bytes,
and the same SHA-256 — matches the generator output exactly.

## Detection vs. ground truth

Every "found" figure is from the agent's PROFILE table; every "planted" figure
is from the manifest.

| Issue class | Planted | Found | |
|---|---:|---:|---|
| Exact duplicate rows (excess copies) | 41 | 41 | exact |
| **Near-duplicates on the logical key** | **28** | **28** | exact |
| Slash dates (day-first) | 2,002 | 2,002 | exact |
| Text dates (`%b %d %Y`) | 1,009 | 1,009 | exact |
| Totals that do not reconcile | 68 | 68 | exact |
| Null `customer` | 68 | 68 | exact |
| Null `qty` | 41 | 41 | exact |
| Null `unit_price` | 11 | 11 | exact |
| Null `total` | 11 | 11 | exact |
| Negative quantity | 23 | 23 | exact |
| `USD` suffix in `unit_price` | 27 | 27 | exact |
| Thousands separators | 12,426 | 12,426 | exact |

**Twelve of twelve planted classes detected exactly**, with no false positives:
the agent reported zero materially conflicting duplicate-key groups, zero
unparseable or future dates, and zero parentheses negatives — none of which the
generator plants.

The near-duplicate row is the one worth dwelling on. These rows share an
`order_id` and differ only in case and stray whitespace (`" Acme Corp "` vs
`"Acme Corp"`, `EAST` vs `East`) — exactly what a plain `drop_duplicates()`
misses. The agent separated the 138 duplicate-key rows into 82 exact-duplicate
rows and 56 cosmetic-only near-duplicate rows across 28 pairs, which is the
planted figure.

The two category classes reconcile rather than tick, and both are reported here
rather than rounded into the headline:

- **Region:** 4,126 planted variants; the delegated canonical map would change
  3,318 rows. The gap is `New York`, which the agent refused to fold into `NYC`
  without asking, because it may be the city or the state.
- **Status:** 5,779 planted; the map would change 5,757. The difference is the
  same kind of thing: which spelling is canonical is a user's decision, not the
  agent's.

## Date inference does not weaken with volume

> Slash date, proven DMY — 2,002 rows. All 2,002 have component >12 evidence;
> no conflicting MDY evidence.

The evidence rule scales unchanged, and the agent reports the count rather than
the conclusion alone.

## Context management: detail to files, summary to context

A full profile of 10,000 rows would bury a chat window, so the agent wrote the
detail to sandbox files and returned only the summary table. The per-row
`affected_rows.csv` stays retrievable and downloadable without ever entering the
model's context — the harness capability doing visible work.

## The event ledger

Everything above is checkable against the turn's own events.


| # | t | event | thread |
|---:|---:|---|---|
| 1 | +0.0s | `turn.created` | — |
| 2 | +4.9s | `model.message` | main |
| 3 | +12.5s | `sandbox.created` | — |
| 4 | +12.1s | `tool.response` | main |
| 5 | +12.5s | `tool.response` | main |
| 6 | +15.3s | `model.message` | main |
| 7 | +15.4s | `tool.response` | main |
| 8 | +18.1s | `model.message` | main |
| 9 | +19.5s | `tool.response` | main |
| 10 | +23.2s | `model.message` | main |
| 11 | +23.2s | `tool.response` | main |
| 12 | +65.0s | `model.message` | main |
| 13 | +65.1s | `tool.response` | main |
| 14 | +70.4s | `model.message` | main |
| 15 | +85.9s | `tool.response` | main |
| 16 | +89.5s | `model.message` | main |
| 17 | +89.5s | `thread.created` | sub:296c9277 |
| 18 | +93.3s | `model.message` | sub:296c9277 |
| 19 | +93.4s | `tool.response` | sub:296c9277 |
| 20 | +96.5s | `model.message` | sub:296c9277 |
| 21 | +96.6s | `tool.response` | sub:296c9277 |
| 22 | +99.0s | `model.message` | sub:296c9277 |
| 23 | +99.1s | `tool.response` | sub:296c9277 |
| 24 | +119.9s | `model.message` | sub:296c9277 |
| 25 | +119.9s | `tool.response` | main |
| 26 | +119.9s | `thread.done` | sub:296c9277 |
| 27 | +123.1s | `model.message` | main |
| 28 | +123.6s | `tool.response` | main |
| 29 | +138.0s | `model.message` | main |
| 30 | +138.1s | `tool.response` | main |
| 31 | +152.1s | `model.message` | main |
| 32 | +152.1s | `tool.response_required` | main |
| 33 | +152.1s | `turn.done` | — |

Total 33 events over +152.1s.


Events 17 through 26 are the subagent: its own thread, its own sandbox `exec`
calls, bracketed by `thread.created` and `thread.done`. The root agent's context
never held that analysis — only its result. The turn ends on
`tool.response_required`: the agent asking, not assuming.

## Transcript

### root agent — +4.9s

I’ll download the CSV into a sandbox working copy, fingerprint it, and run the full checklist in one reproducible profiling script. I’ll keep detailed metrics and row-level evidence in sandbox files, report only headline counts and a compact findings table here, then ask all material clarifications together and stop.

### root agent — tool call `exec` — +4.9s

```json
{"command":"if [ -f skills/data-cleaning/SKILL.md ]; then cat skills/data-cleaning/SKILL.md; else echo 'SKILL_NOT_FOUND'; fi","cwd":".","intent":"Load the prescribed data-cleaning methodology before profiling."}
```

### root agent — tool call `exec` — +4.9s

```json
{"command":"mkdir -p work/cleanroom_sales_profile && curl -L --fail --silent --show-error 'https://raw.githubusercontent.com/sreenathmmenon/cleanroom/feat/scale-proof/data/samples/sales_export_large.csv' -o work/cleanroom_sales_profile/sales_export_large.csv && wc -c work/cleanroom_sales_profile/sales_export_large.csv && shasum -a 256 work/cleanroom_sales_profile/sales_export_large.csv","cwd":".","intent":"Download the dataset into the sandbox and capture its size and cryptographic fingerprint."}
```

### root agent — tool call `exec` — +15.3s

```json
{"command":"head -c 200 work/cleanroom_sales_profile/sales_export_large.csv && echo \"==\" && genson work/cleanroom_sales_profile/sales_export_large.csv","cwd":".","intent":"Inspect a minimal sample and infer the file structure before writing the profiler."}
```

### root agent — tool call `exec` — +18.1s

```json
{"command":"pip install -q genson && head -c 200 work/cleanroom_sales_profile/sales_export_large.csv && echo \"==\" && genson work/cleanroom_sales_profile/sales_export_large.csv","cwd":".","intent":"Install the stated schema utility and complete the required structural inspection."}
```

### root agent — tool call `get_current_datetime` — +23.2s

```json
{}
```

### root agent — +65.0s

The file is safely copied and fingerprinted. I’m now profiling dates, numeric encodings, categorical variants, key collisions, computed totals, and impossible values against the current UTC date (2026-08-29); detailed samples and affected-row identifiers will go to artifacts rather than the chat.

### root agent — tool call `exec` — +65.0s

```json
{"command":"cat > work/cleanroom_sales_profile/profile.py <<'PY'\nimport pandas as pd, numpy as np, re, json, hashlib\nfrom pathlib import Path\nfrom datetime import datetime, timezone\nfrom decimal import Decimal, InvalidOperation\n\nBASE=Path('work/cleanroom_sales_profile')\nSRC=BASE/'sales_export_large.csv'\nTODAY=pd.Timestamp('2026-08-29')\n\ndf=pd.read_csv(SRC, dtype=str, keep_default_na=True)\nraw=df.copy()\nN=len(df)\nkey='order_id' if 'order_id' in df.columns else df.columns[0]\n\ndef ids(mask):\n    return df.loc[mask,key].fillna('<null>').astype(str).tolist()\ndef sample(mask, col=None, n=5):\n    z=df.loc[mask]\n    cols=[key]+(([col] if col and col!=key else []))\n    return z[cols].head(n).fillna('<null>').to_dict('records')\ndef clean_text(x):\n    if pd.isna(x): return None\n    return re.sub(r'\\s+',' ',str(x).strip()).casefold()\ndef cat_key(x):\n    if pd.isna(x): return None\n    return re.sub(r'[^a-z0-9]+','',str(x).casefold())\ndef parse_num(x):\n    if pd.isna(x): return np.nan\n    s=str(x).strip()\n    neg=s.startswith('(') and s.endswith(')')\n    if neg: s=s[1:-1]\n    s=re.sub(r'[$€£¥₹,\\s]','',s)\n    s=re.sub(r'(?i)(usd|eur|gbp|cad|aud|pcs?|units?|kg|lbs?)$','',s).strip()\n    try:\n        v=float(s)\n        return -v if neg else v\n    except: return np.nan\n\ndef date_info(series):\n    vals=series.dropna().astype(str)\n    slash=vals[vals.str.match(r'^\\s*\\d{1,2}/\\d{1,2}/\\d{2,4}\\s*$')]\n    dmy_evidence=mdy_evidence=0\n    for v in slash:\n        a,b,*_=map(int,re.findall(r'\\d+',v))\n        if a>12 and b<=12: dmy_evidence+=1\n        if b>12 and a<=12: mdy_evidence+=1\n    if dmy_evidence and not mdy_evidence: slash_order='DMY'\n    elif mdy_evidence and not dmy_evidence: slash_order='MDY'\n    elif dmy_evidence and mdy_evidence: slash_order='MIXED'\n    elif len(slash): slash_order='AMBIGUOUS'\n    else: slash_order='NONE'\n    parsed=[]; styles=[]\n    for x in series:\n        if pd.isna(x): parsed.append(pd.NaT); styles.a
```

### root agent — tool call `exec` — +70.4s

```json
{"command":"pip install -q pandas tabulate && python work/cleanroom_sales_profile/profile.py","cwd":".","intent":"Install the local tabular-analysis dependencies and rerun the profiler."}
```

### root agent — tool call `create_sub_agent` — +89.5s

```json
{"name":"category-canonicalization-review","input":"Analyze category canonicalization candidates for a Cleanroom PROFILE only. Read `/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17afdcvdb5rpzprfvr0kkn9/01m17afj5m5811v36cmepttbt8/work/cleanroom_sales_profile/category_candidates.json`, which contains distinct values/counts and cosmetic variant groups for multiple low-cardinality columns. Return only: (1) a proposed canonical map per column, (2) exact row count each individual mapping changes and total changes per column, and (3) any genuinely ambiguous variants. Do not modify files, do not plan/apply fixes, and keep reasoning concise."}
```

### subagent 296c9277 — tool call `exec` — +93.3s

```json
{"intent":"Inspect the candidate file’s sample and structure before analyzing mappings.","command":"head -c 200 '/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17afdcvdb5rpzprfvr0kkn9/01m17afj5m5811v36cmepttbt8/work/cleanroom_sales_profile/category_candidates.json' && echo \"==\" && genson '/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17afdcvdb5rpzprfvr0kkn9/01m17afj5m5811v36cmepttbt8/work/cleanroom_sales_profile/category_candidates.json'","cwd":"/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17afdcvdb5rpzprfvr0kkn9/01m17afj5m5811v36cmepttbt8/work"}
```

### subagent 296c9277 — tool call `exec` — +96.5s

```json
{"intent":"Summarize the JSON structure and candidate groups without altering the file.","command":"jq '{columns: keys, structure: with_entries(.value |= {keys: keys, distinct_nonnull, count_entries:(.counts|length), cosmetic_group_count:(.cosmetic_groups|length)})}' 'cleanroom_sales_profile/category_candidates.json'","cwd":"/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17afdcvdb5rpzprfvr0kkn9/01m17afj5m5811v36cmepttbt8/work"}
```

### subagent 296c9277 — tool call `exec` — +99.0s

```json
{"intent":"Extract value frequencies and supplied variant groups needed to calculate exact mapping impacts.","command":"jq 'with_entries(.value |= {counts, variant_groups, affected_rows_in_variant_groups, minimum_rows_to_change})' 'cleanroom_sales_profile/category_candidates.json'","cwd":"/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17afdcvdb5rpzprfvr0kkn9/01m17afj5m5811v36cmepttbt8/work"}
```

### subagent 296c9277 — +119.9s

## 1. Proposed canonical maps and row changes

### `customer`
| Variant | Canonical | Rows changed |
|---|---|---:|
| `" Globex Incorporated "` | `"Globex Incorporated"` | 1 |
| `" Umbrella Ltd "` | `"Umbrella Ltd"` | 5 |
| `" Massive Dynamic "` | `"Massive Dynamic"` | 4 |
| `" Wayne Enterprises "` | `"Wayne Enterprises"` | 3 |
| `" Acme Corp "` | `"Acme Corp"` | 4 |
| `" Soylent Co "` | `"Soylent Co"` | 2 |
| `" Stark Industries "` | `"Stark Industries"` | 4 |
| `" Vehement Capital "` | `"Vehement Capital"` | 3 |
| `" Hooli "` | `"Hooli"` | 2 |

**Total changes: 28**

### `region`
| Variant | Canonical | Rows changed |
|---|---|---:|
| `"EAST"` | `"East"` | 9 |
| `"West"` | `"west"` | 1,659 |
| `"WEST"` | `"west"` | 11 |
| `"n-y-c"` | `"NYC"` | 818 |
| `"nyc"` | `"NYC"` | 816 |
| `"N-Y-C"` | `"NYC"` | 5 |

**Total changes: 3,318**

### `status`
| Variant | Canonical | Rows changed |
|---|---|---:|
| `"Pending"` | `"pending"` | 2,420 |
| `"shipped"` | `"SHIPPED"` | 1,676 |
| `"Shipped"` | `"SHIPPED"` | 1,661 |

**Total changes: 5,757**

## 2. Genuinely ambiguous variants

- `customer`: `"nan"` (68) — ambiguous missing-value representation; no mapping proposed.
- `region`: `"New York"` (805) versus the NYC group — could mean New York City or a broader geography; no mapping proposed.
- `region`: `"west"` (1,662) versus `"West"` (1,659) — canonical casing is effectively tied; proposed map uses the plurality form.
- `region`: `"NYC"` (828), `"n-y-c"` (818), and `"nyc"` (816) — canonical formatting is closely split; proposed map uses the plurality form.
- `status`: `"pending"` (2,522) versus `"Pending"` (2,420) — canonical casing is closely split.
- `status`: `"SHIPPED"` (1,698), `"shipped"` (1,676), and `"Shipped"` (1,661) — canonical casing is closely split; proposed map uses the plurality form.

### root agent — tool call `exec` — +123.1s

```json
{"command":"python - <<'PY'\nimport pandas as pd, json\np='work/cleanroom_sales_profile/'\nf=pd.read_csv(p+'findings.csv')\nprint(f[['issue_type','column','affected_rows','minimum_rows_to_change']].fillna('').to_string(index=False))\nm=json.load(open(p+'profile_metrics.json'))\nprint('\\nNULLS',m['nulls_per_column'])\nprint('FUTURE',m['issue_class_counts'].get('future date [order_date]',0))\nprint('CATEGORIES')\nfor c,v in m['category_profile'].items(): print(c,v['distinct_nonnull'],v['affected_rows_in_variant_groups'],v['minimum_rows_to_change'])\nPY","cwd":".","intent":"Extract a compact measured summary from the profiling artifacts for review."}
```

### root agent — tool call `exec` — +138.0s

```json
{"command":"cat > work/cleanroom_sales_profile/category_mapping_proposal.md <<'MD'\n# Delegated category canonicalization proposal\n\nThe canonicalization analysis was delegated because three low-cardinality columns contain cosmetic variants. Counts below are measured from the profile; no mapping has been applied.\n\n## customer — 28 proposed changes\n\n| Raw value | Proposed canonical | Rows changed |\n|---|---|---:|\n| ` Globex Incorporated ` | `Globex Incorporated` | 1 |\n| ` Umbrella Ltd ` | `Umbrella Ltd` | 5 |\n| ` Massive Dynamic ` | `Massive Dynamic` | 4 |\n| ` Wayne Enterprises ` | `Wayne Enterprises` | 3 |\n| ` Acme Corp ` | `Acme Corp` | 4 |\n| ` Soylent Co ` | `Soylent Co` | 2 |\n| ` Stark Industries ` | `Stark Industries` | 4 |\n| ` Vehement Capital ` | `Vehement Capital` | 3 |\n| ` Hooli ` | `Hooli` | 2 |\n\n## region — 3,318 proposed changes\n\n| Raw value | Proposed canonical | Rows changed |\n|---|---|---:|\n| `EAST` | `East` | 9 |\n| `West` | `west` | 1,659 |\n| `WEST` | `west` | 11 |\n| `n-y-c` | `NYC` | 818 |\n| `nyc` | `NYC` | 816 |\n| `N-Y-C` | `NYC` | 5 |\n\nAmbiguities: whether the canonical casing should be `West` rather than plurality `west`; whether `New York` (805 rows) means NYC and should join the NYC group.\n\n## status — 5,757 proposed changes\n\n| Raw value | Proposed canonical | Rows changed |\n|---|---|---:|\n| `Pending` | `pending` | 2,420 |\n| `shipped` | `SHIPPED` | 1,676 |\n| `Shipped` | `SHIPPED` | 1,661 |\n\nAmbiguities: casing choices are closely split. A business convention (for example Title Case) is preferable to plurality.\n\n## Null note\n\n`customer` has 68 true nulls. They are not category strings and are excluded from the proposed map.\nMD\ncat >> work/cleanroom_sales_profile/detailed_profile.md <<'MD'\n\n## Delegated category canonicalization review\n\nSee `category_mapping_proposal.md`. Analysis was delegated because three low-cardinality columns require mappings. Proposed row changes: customer 28, region 3,318, st
```

### root agent — +152.1s

## PROFILE summary

**Fingerprint:** 10,000 rows × 9 columns; 801,813 bytes; SHA-256 `cf94f3a1b63da81933181196baac85a513ac943501f57a1e79d67a0aa5ee2f1f`.

| Issue class | Column | Affected rows | Notes |
|---|---|---:|---|
| Currency symbol stored as text | `total` | 9,989 | All parse successfully |
| Category-variant group membership | `status` | 9,977 | Delegated map would change 5,757 |
| Currency symbol stored as text | `unit_price` | 9,962 | All parse successfully |
| Category-variant group membership | `region` | 9,195 | Delegated map would change 3,318 |
| Category-variant group membership | `customer` | 8,963 | Delegated map would change 28 |
| Thousands separator stored as text | `total` | 7,316 | Overlaps currency-symbol rows |
| Thousands separator stored as text | `unit_price` | 5,110 | Overlaps currency-symbol rows |
| Slash date, proven DMY | `order_date` | 2,002 | All 2,002 have component >12 evidence; no conflicting MDY evidence |
| Text date (`%b %d %Y`) | `order_date` | 1,009 | Parseable |
| Exact duplicate rows | all | 82 | 41 duplicate pairs/excess rows |
| Computed-total mismatch | `total` | 68 | Among 9,959 computable rows; tolerance >$0.01 |
| Null | `customer` | 68 | True nulls |
| Near-duplicate on `order_id`, cosmetic differences only | key/row | **56** | **28 pairs/excess rows** |
| Null | `qty` | 41 | |
| Unit suffix stored as text | `unit_price` | 27 | Parseable |
| Negative quantity | `qty` | 23 | Business interpretation needed |
| Null | `unit_price` | 11 | |
| Null | `total` | 11 | |

**Headline checks**

- Null cells: **131**; fully-null rows: **0**.
- Duplicate `order_id`: **138 rows across 69 key groups** = 82 exact-duplicate rows + 56 cosmetic-only near-duplicate rows. Materially conflicting duplicate-key rows: **0**.
- ISO dates: **6,989**; non-ISO but parseable: **3,011**; unparseable dates: **0**; future dates relative to 2026-08-29 UTC: **0**.
- Negative quantities: **23**. Parentheses negatives: **0**.
- Product category variants: **0**.
- Category analysis was delegated as required; no mappings were applied.

Detailed metrics, all affected row numbers/IDs, category counts, and reproducible code are available here:

```sandbox_artifacts
[Detailed profiling report](/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17afdcvdb5rpzprfvr0kkn9/01m17afj5m5811v36cmepttbt8/work/cleanroom_sales_profile/detailed_profile.md)
[Findings table CSV](/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17afdcvdb5rpzprfvr0kkn9/01m17afj5m5811v36cmepttbt8/work/cleanroom_sales_profile/findings.csv)
[Affected-row evidence CSV](/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17afdcvdb5rpzprfvr0kkn9/01m17afj5m5811v36cmepttbt8/work/cleanroom_sales_profile/issue_rows.csv)
[Machine-readable profile metrics](/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17afdcvdb5rpzprfvr0kkn9/01m17afj5m5811v36cmepttbt8/work/cleanroom_sales_profile/profile_metrics.json)
[Delegated category mapping proposal](/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17afdcvdb5rpzprfvr0kkn9/01m17afj5m5811v36cmepttbt8/work/cleanroom_sales_profile/category_mapping_proposal.md)
[Reproducible profiling script](/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17afdcvdb5rpzprfvr0kkn9/01m17afj5m5811v36cmepttbt8/work/cleanroom_sales_profile/profile.py)
```

### root agent — tool call `ask_user_question` — +152.1s

```json
{"question":"CLARIFY — please answer these together in a numbered reply (no plan or changes will be made yet): 1) What is the destination/use (BI import, analysis, migration, or another stated use)? 2) Confirm `order_id` is the uniqueness key and whether exact/cosmetic duplicate pairs should eventually retain one row. 3) Are `$` and `USD` unit-price forms all USD? 4) For 68 total mismatches, which field is authoritative: `total`, or `qty × unit_price`? 5) Do negative quantities represent valid returns, or invalid data? 6) What null policy should eventually apply to customer (68), qty (41), unit_price (11), and total (11): preserve, source-correct, impute under a stated rule, or drop affected rows? 7) Category conventions: approve trimmed customer names; choose casing for region/status; and say whether `New York` (805 rows) should remain distinct from `NYC`.","options":[]}
```


## Reproducing this

```bash
python3 scripts/make_large_corpus.py   # regenerates the identical corpus + manifest
```

Then point a session at the corpus and compare its PROFILE counts against
`data/samples/large_manifest.json`.
