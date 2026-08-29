# Real-world run — 5,000 rows of NYC 311, nothing planted

Every other corpus in this repo was built here, which means a profiling run
against them measures the agent against the author's imagination. This one was
not: it is a slice of
[NYC 311 Service Requests](https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9)
(CC0), 44 columns of real municipal data, and the agent was told nothing about
what was wrong with it.

- Corpus: `data/samples/nyc311_service_requests.csv` — 5,000 rows × 44 columns
- SHA-256 `cb2ccad947bbc7b13fad737a4d3201e9…`
- Session `01m17wzvbea3gr96bmqgagpj97`, turn `01m17wzvdge1a2tcpcq2pdh3x8`
- PROFILE + CLARIFY in **~4 minutes**

`data/samples/nyc311_reference.json` is what an independent script measures in
the same file. It is a **reference, not a manifest**: nothing was planted, so it
scores the agent against reality.

## Scored against the reference

| Check | Reference | Agent | |
|---|---:|---:|---|
| Rows × columns | 5,000 × 44 | 5,000 × 44 | exact |
| Exact duplicate rows | 0 | 0 | exact |
| Duplicate `unique_key` | 0 | 0 | exact |
| **`closed_date` earlier than `created_date`** | **32** | **32** | exact |
| Non-closed status carrying a `closed_date` | 148 | 148 | exact |
| `police_precinct` stored as `Precinct <n>` labels | 4,913 | 4,913 | exact |
| `location_type` case-variant rows | 41 | 41 | exact |
| Columns ≥95% missing | 10 | 10 | exact |

**Eight of eight, exact.** No false positives: the agent reported 0 unparseable
dates across 10,569 populated date values, 0 future incident timestamps, and
confirmed all 4,918 WKT locations parse and agree with their latitude/longitude.

## Three of those numbers corrected *my* script

This is the part worth reading, because the reference was written first and the
agent disagreed with it three times. The agent was right every time.

**Columns ≥95% missing — agent said 10, my script said 9.** My check counted
empty cells. `park_facility_name` is never empty: it is the literal string
`Unspecified` in 4,997 rows and `N/A` in 3. It is 100% missing and 0% empty. The
agent treated the sentinel as missing, which is what the column actually means.

**`police_precinct` — agent said 4,913, my script said 5,000.** All 5,000 rows
are populated, but 87 read `Unspecified`. The agent counted the ones that are
*losslessly convertible to an integer*, which is the number that matters for the
fix it was proposing.

**`location_type` — agent said 41, my script said 3,505.** Mine counted every
non-uppercase value. Only one of them is a genuine case variant:
`Residential Building` (41 rows) against `RESIDENTIAL BUILDING` (1,055). The
other 3,464 are values with no uppercase twin — not canonicalization candidates
at all. The agent counted rows that would actually change.

The reference in this repo has been corrected to match. An agent that finds a
defect the verification script missed is the point of running it on data nobody
prepared.

## The judgment call it did not get wrong

Thirty-two tickets are closed before they were created. A naive repair swaps or
nulls them. The agent measured the *distribution* first — every inversion is
between 1 and 29 seconds — and concluded they are source precision artifacts,
recommending they be **preserved**, not repaired. Likewise the 1,203
resolution-update inversions, whose timestamps are all midnight: date-only
granularity, not corruption.

It made the same call on the 145 near-duplicate operational signatures: unique
keys are genuinely unique, so it proposed keeping all of them and flagging
rather than dropping 78 rows.

Repairing real data means knowing which anomalies are errors and which are how
the source records the world.

## One consolidated question

Ten decisions, one round, with a recommended bundle and a free-text escape:

```json
{
  "question": "Please decide all ambiguities in one response. Recommended conservative policy: (1) make the export analysis-friendly; (2) convert 4,913 `police_precinct` labels losslessly to integers; (3) map 41 `Residential Building` values to `RESIDENTIAL BUILDING`; (4) preserve all 145 near-duplicate rows because keys are unique; (5) preserve the 32 sub-minute closure/creation inversions as source precision artifacts; (6) preserve the 1,203 midnight resolution-update inversions as date-granularity artifacts; (7) preserve the 148 non-closed/status lifecycle records; (8) preserve and flag the 4 borough/BBL conflicts; (9) preserve and flag the 2 partial X/Y pairs; and (10) retain sparse columns and existing nulls without imputation. Choose a bundle below, or use the free-text field to answer items 1–10 individually. Any row drops or value overwrites will be labelled destructive in the plan.",
  "options": [
    "Use the full conservative policy above (Recommended)",
    "Minimal cleanup: canonicalize only precinct and location type; preserve everything else without additional integrity flags",
    "Integrity-enforcing cleanup: canonicalize fields, drop 78 near-duplicate excess rows, repair the 32 closure inversions, and null conflicting lifecycle/BBL/coordinate values"
  ]
}
```

Every option is reversible except the third, which is the one labelled with its
row drops.

## Delegation was correctly skipped

> Only one low-cardinality column needs canonicalization, so delegation was not
> required.

The instructions delegate when more than one categorical column needs a canon
map. Here exactly one did, so the agent did it inline — the conditional rule
working as designed rather than delegating for show.

## Event ledger


| # | t | event | thread |
|---:|---:|---|---|
| 1 | +0.0s | `turn.created` | — |
| 2 | +5.8s | `model.message` | main |
| 3 | +14.5s | `sandbox.created` | — |
| 4 | +14.5s | `tool.response` | main |
| 5 | +21.3s | `model.message` | main |
| 6 | +21.4s | `tool.response` | main |
| 7 | +21.3s | `tool.response` | main |
| 8 | +69.8s | `model.message` | main |
| 9 | +70.0s | `tool.response` | main |
| 10 | +73.0s | `model.message` | main |
| 11 | +91.3s | `tool.response` | main |
| 12 | +109.9s | `model.message` | main |
| 13 | +111.2s | `tool.response` | main |
| 14 | +131.6s | `model.message` | main |
| 15 | +132.2s | `tool.response` | main |
| 16 | +134.5s | `model.message` | main |
| 17 | +134.9s | `tool.response` | main |
| 18 | +153.0s | `model.message` | main |
| 19 | +153.0s | `tool.response_required` | main |
| 20 | +153.0s | `turn.done` | — |

Total 20 events over +153.0s.


The turn ends on `tool.response_required`. On 44 columns of unfamiliar municipal
data, the agent measured, judged what was an artifact versus an error, and
stopped for a person.

## Transcript


### root agent — +5.8s

I’ll download the source into a sandbox working copy, inspect the full cleaning skill and any matching recipe, then fingerprint and profile all 44 columns—including cross-column date, location, and status integrity. I’ll write detailed findings to sandbox files and return only the measured summary, one consolidated clarification round, and the approval-gated plan.

### root agent — tool call `exec` — +5.8s

```json
{"intent":"Download the dataset, locate the cleaning methodology and any available recipe, and fingerprint the untouched sandbox copy.","command":"set -euo pipefail\nmkdir -p work/nyc311_profile\ncurl -fsSL 'https://raw.githubusercontent.com/sreenathmmenon/cleanroom/feat/real-world-corpus/data/samples/nyc311_service_requests.csv' -o work/nyc311_profile/source.csv\nprintf '%s\\n' '--- available relevant skills ---'\nfind skills -maxdepth 4 -type f \\( -name 'SKILL.md' -o -name '*recipe*' \\) -print 2>/dev/null | sort || true\nprintf '%s\\n' '--- fingerprint ---'\nsha256sum work/nyc311_profile/source.csv\npython - <<'PY'\nimport csv\np='work/nyc311_profile/source.csv'\nwith open(p, newline='', encoding='utf-8-sig') as f:\n    r=csv.reader(f); hdr=next(r); n=sum(1 for _ in r)\nprint(f'rows={n}')\nprint(f'columns={len(hdr)}')\nprint('headers=' + ' | '.join(hdr))\nPY","cwd":"."}
```

### root agent — tool call `exec` — +21.3s

```json
{"intent":"Inspect the file prefix using the required schema-inference command before building the profiler.","command":"head -c 200 work/nyc311_profile/source.csv && echo \"==\" && genson work/nyc311_profile/source.csv || true\ncp work/nyc311_profile/source.csv work/nyc311_profile/working_copy.csv","cwd":"."}
```

### root agent — tool call `get_current_datetime` — +21.3s

```json
{}
```

### root agent — +69.8s

The intake fingerprint is complete: **5,000 rows × 44 columns**, SHA-256 `cb2ccad947bbc7b13fad737a4d3201e9a0fb1c77b3df2704470c59920ddba76e`. No attached cleaning skill or dataset recipe was available, so I’m using the embedded methodology as a first run. The original download remains untouched; profiling will run against `working_copy.csv`.

### root agent — tool call `exec` — +69.8s

```json
{"intent":"Create and run one comprehensive profiler, saving every metric and detailed row-level evidence to sandbox reports.","command":"cat > work/nyc311_profile/profile.py <<'PY'\nimport pandas as pd, numpy as np, re, json, hashlib, unicodedata\nfrom pathlib import Path\nfrom collections import defaultdict\nfrom datetime import datetime, timezone\n\nBASE=Path('work/nyc311_profile')\nSRC=BASE/'working_copy.csv'\nNOW=pd.Timestamp('2026-08-29T23:17:23.345Z').tz_convert(None)\nNA_TOKENS={'','na','n/a','null','none','nan','unknown','unspecified'}\n\ndef clean_str(s):\n    if pd.isna(s): return None\n    x=str(s).strip()\n    return None if x.lower() in NA_TOKENS else x\n\ndef canon(s):\n    x=clean_str(s)\n    if x is None: return None\n    x=unicodedata.normalize('NFKC',x).casefold().strip()\n    x=re.sub(r'[\\s_\\-]+',' ',x)\n    x=re.sub(r'[^\\w\\s]','',x)\n    return re.sub(r'\\s+',' ',x).strip()\n\ndef parse_date_series(s):\n    out=pd.Series(pd.NaT,index=s.index,dtype='datetime64[ns]')\n    styles=defaultdict(int); bad=[]\n    for i,v in s.items():\n        x=clean_str(v)\n        if x is None: continue\n        dt=None; sty=None\n        fmts=[\n          ('iso_date','%Y-%m-%d'),('iso_datetime','%Y-%m-%d %H:%M:%S'),\n          ('text_mdy','%b %d %Y'),('text_dmy','%d %b %Y'),\n          ('slash_mdy_12h','%m/%d/%Y %I:%M:%S %p'),('slash_mdy_24h','%m/%d/%Y %H:%M:%S'),\n          ('slash_dmy_12h','%d/%m/%Y %I:%M:%S %p'),('slash_dmy_24h','%d/%m/%Y %H:%M:%S'),\n          ('slash_mdy','%m/%d/%Y'),('slash_dmy','%d/%m/%Y')]\n        for name,fmt in fmts:\n            try: dt=datetime.strptime(x,fmt); sty=name; break\n            except ValueError: pass\n        if dt is not None:\n            out.at[i]=dt; styles[sty]+=1\n        else: bad.append((int(i),x))\n    return out,dict(styles),bad\n\ndf=pd.read_csv(SRC,dtype=str,keep_default_na=False,na_filter=False)\n# Convert recognized null tokens to pd.NA only for analysis; source is unchanged.\na=df.apply(lambda c: c.map(c
```

### root agent — +73.0s

The profiling script is prepared, but the sandbox lacks the tabular-analysis dependency needed to execute it. I’ll install that dependency locally in the persistent sandbox, rerun the same script unchanged, and then validate the report counts independently before forming the plan.

### root agent — tool call `exec` — +73.0s

```json
{"intent":"Install the local tabular-analysis dependency and rerun the prepared profiler without changing its checks.","command":"set -euo pipefail\npip install -q pandas tabulate\npython work/nyc311_profile/profile.py > work/nyc311_profile/profile_full.txt\npython - <<'PY'\nimport pandas as pd, json\np='work/nyc311_profile'\nf=pd.read_csv(p+'/findings.csv')\nprint(f.to_string(index=False,max_colwidth=90))\nprint('\\nmetrics=',json.load(open(p+'/metrics.json')))\nPY","cwd":"."}
```

### root agent — +109.9s

The first execution exposed two profiler assumptions that do not fit this real export: its timestamps are ISO-8601 with `T` plus milliseconds, and `location` uses WKT `POINT (longitude latitude)`, not a `(latitude, longitude)` tuple. I’m correcting those parsing rules—not the data—and narrowing numeric-text detection so street names such as “47 STREET” are not falsely classified. Then I’ll rerun all counts and cross-column checks.

### root agent — tool call `exec` — +109.9s

```json
{"intent":"Correct the profiler's timestamp, geospatial, precinct, and numeric-text recognition rules, then rerun the full measured profile.","command":"python - <<'PY'\np='work/nyc311_profile/profile.py'\ns=open(p).read()\ns=s.replace(\"('iso_date','%Y-%m-%d'),('iso_datetime','%Y-%m-%d %H:%M:%S'),\", \"('iso_date','%Y-%m-%d'),('iso_datetime','%Y-%m-%d %H:%M:%S'),('iso_t_millis','%Y-%m-%dT%H:%M:%S.%f'),('iso_t_seconds','%Y-%m-%dT%H:%M:%S'),\")\nstart=s.index(\"print('\\\\nNUMBERS-AS-TEXT')\")\nend=s.index(\"print('\\\\nFIELD FORMAT AND RANGE CHECKS')\")\nnew=\"\"\"print('\\\\nNUMBERS-AS-TEXT')\n# Restrict this check to semantically numeric fields; street/address tokens such as '47 STREET' are identifiers, not units.\nsemantic_numeric=['unique_key','incident_zip','council_district','police_precinct','bbl','x_coordinate_state_plane','y_coordinate_state_plane','latitude','longitude']\nfor c in semantic_numeric:\n    vals=a[c].dropna()\n    bad=[]\n    for i,x in vals.items():\n        raw=x.strip()\n        plain=raw.replace(',','')\n        if c=='police_precinct':\n            if re.fullmatch(r'(?i)precinct\\\\s+\\\\d+',raw): bad.append(i)\n        elif not re.fullmatch(r'[+-]?(?:\\\\d+(?:\\\\.\\\\d*)?|\\\\.\\\\d+)',plain): bad.append(i)\n        elif ',' in raw: bad.append(i)\n    if bad:\n        print(f'{c}: formatted_numeric_rows={len(bad)} samples={[a.at[i,c] for i in bad[:5]]}')\n        add('numeric values stored with formatting/units',c,bad,[a.at[i,c] for i in bad[:5]],'Normalize losslessly to the semantic numeric value','safe')\n\n\"\"\"\ns=s[:start]+new+s[end:]\nold=\"\"\"for c,lo,hi in [('council_district',1,51),('police_precinct',1,123)]:\n    z=pd.to_numeric(a[c],errors='coerce'); bad=a[c].notna() & (z.isna() | (z<lo) | (z>hi))\n    cross(f'{c} outside expected NYC range',c,bad,['unique_key',c],'Review and correct only from authoritative evidence')\"\"\"\nnew2=\"\"\"for c,lo,hi in [('council_district',1,51),('police_precinct',1,123)]:\n    raw=a[c].str.r
```

### root agent — tool call `exec` — +131.6s

```json
{"intent":"Validate headline counts independently and generate concise evidence tables and previews for all policy decisions.","command":"cat > work/nyc311_profile/decision_evidence.py <<'PY'\nimport pandas as pd, json, re\nfrom pathlib import Path\nP=Path('work/nyc311_profile'); d=pd.read_csv(P/'working_copy.csv',dtype=str,keep_default_na=False)\nd=d.replace('',pd.NA)\n# Category map evidence\ncat=json.load(open(P/'category_candidates.json'))\n# Near duplicate signature groups\nnearcols=['created_date','agency','complaint_type','descriptor','incident_zip','incident_address','latitude','longitude']\ng=d[d.duplicated(nearcols,keep=False)].sort_values(nearcols)\nng=g.groupby(nearcols,dropna=False)\nnear_summary=pd.DataFrame([{'group_size':len(x),'keys':', '.join(x.unique_key.astype(str)),'statuses':', '.join(sorted(x.status.dropna().unique())),'closed_dates':x.closed_date.nunique(dropna=False)} for _,x in ng])\n# anomalies\nfor c in ['created_date','closed_date','due_date','resolution_action_updated_date']:\n    d[c+'_p']=pd.to_datetime(d[c],errors='coerce')\nclosed_before=d[d.closed_date_p<d.created_date_p]\nres_before=d[d.resolution_action_updated_date_p<d.created_date_p]\nnonclosed=d[(d.status.str.casefold()!='closed')&d.closed_date.notna()]\nbmap={'MANHATTAN':'1','BRONX':'2','BROOKLYN':'3','QUEENS':'4','STATEN ISLAND':'5'}\nbblmis=d[d.bbl.notna()&d.borough.map(bmap).notna()&(d.bbl.str.replace(r'\\.0$','',regex=True).str[0]!=d.borough.map(bmap))]\npartialxy=d[d.x_coordinate_state_plane.isna() ^ d.y_coordinate_state_plane.isna()]\n# precision distribution for closed-before\nlags=(closed_before.created_date_p-closed_before.closed_date_p).dt.total_seconds()\n# status summary\nstatus=pd.crosstab(d.status,d.closed_date.notna()).rename(columns={False:'closed_date_null',True:'closed_date_present'})\nwith open(P/'decision_evidence.md','w') as f:\n f.write('# Decision evidence\\n\\n')\n f.write('## Category variants\\n```json\\n'+json.dumps(cat,indent=2)+'\\n```\\n\\n')\n f
```

### root agent — tool call `exec` — +134.5s

```json
{"intent":"Finish the decision-evidence report after replacing display-only nulls with explicit labels.","command":"python - <<'PY'\np='work/nyc311_profile/decision_evidence.py'; s=open(p).read(); s=s.replace(\"x[cols].head(5).to_markdown(index=False)\", \"x[cols].head(5).fillna('[null]').to_markdown(index=False)\"); open(p,'w').write(s)\nPY\npython work/nyc311_profile/decision_evidence.py","cwd":"."}
```

### root agent — +153.0s

## PROFILE summary

No attached recipe matched or was available; this is a first-run profile using the embedded methodology. All counts below were measured against the untouched sandbox copy.

| Finding | Affected |
|---|---:|
| Rows / columns | 5,000 / 44 |
| Fully-null rows | 0 |
| Exact duplicates / duplicate `unique_key`s | 0 / 0 |
| Near-duplicate operational signatures | 145 rows in 67 groups; 78 excess if deduplicated |
| Unparseable dates | 0 across 10,569 populated date values |
| `police_precinct` stored as labels such as `Precinct 72` | 4,913 |
| `location_type` case variants | 41 (`Residential Building` vs 1,055 uppercase values) |
| `closed_date < created_date` | 32; all differ by only 1–29 seconds |
| Resolution update before creation | 1,203; samples show midnight timestamps, indicating date-only granularity |
| Non-closed status with populated `closed_date` | 148 |
| BBL borough digit inconsistent with `borough` | 4 |
| Partial state-plane X/Y pair | 2 |
| Columns at least 95% null | 10 |
| Future incident/closure/resolution timestamps | 0 |
| Future due dates | 2, both treated as scheduled—not impossible |

Geospatial integrity is otherwise strong: all 4,918 populated WKT locations parse, all agree with latitude/longitude, no lat/lon pairs are partial, and none fall outside broad NYC bounds. No arithmetic computed columns exist; the cross-column checks covered lifecycle dates/status, WKT versus coordinates, coordinate-pair completeness, and borough versus BBL. Only one low-cardinality column needs canonicalization, so delegation was not required.

Detailed reports:

```sandbox_artifacts
[Full profiler output](/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17wzvbea3gr96bmqgagpj97/01m17x014q1xzj830b2beybnkg/work/nyc311_profile/profile_full.txt)
[Sorted findings table](/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17wzvbea3gr96bmqgagpj97/01m17x014q1xzj830b2beybnkg/work/nyc311_profile/findings.csv)
[Decision evidence and previews](/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17wzvbea3gr96bmqgagpj97/01m17x014q1xzj830b2beybnkg/work/nyc311_profile/decision_evidence.md)
[Row-level evidence indices](/Users/sreenath/Library/Application Support/trueforge/sandboxes/01m17wzvbea3gr96bmqgagpj97/01m17x014q1xzj830b2beybnkg/work/nyc311_profile/row_evidence.json)
```

I need one consolidated policy decision before I can produce the exact fix plan and approval gate.

### root agent — tool call `ask_user_question` — +153.0s

```json
{"question":"Please decide all ambiguities in one response. Recommended conservative policy: (1) make the export analysis-friendly; (2) convert 4,913 `police_precinct` labels losslessly to integers; (3) map 41 `Residential Building` values to `RESIDENTIAL BUILDING`; (4) preserve all 145 near-duplicate rows because keys are unique; (5) preserve the 32 sub-minute closure/creation inversions as source precision artifacts; (6) preserve the 1,203 midnight resolution-update inversions as date-granularity artifacts; (7) preserve the 148 non-closed/status lifecycle records; (8) preserve and flag the 4 borough/BBL conflicts; (9) preserve and flag the 2 partial X/Y pairs; and (10) retain sparse columns and existing nulls without imputation. Choose a bundle below, or use the free-text field to answer items 1–10 individually. Any row drops or value overwrites will be labelled destructive in the plan.","options":["Use the full conservative policy above (Recommended)","Minimal cleanup: canonicalize only precinct and location type; preserve everything else without additional integrity flags","Integrity-enforcing cleanup: canonicalize fields, drop 78 near-duplicate excess rows, repair the 32 closure inversions, and null conflicting lifecycle/BBL/coordinate values"]}
```

