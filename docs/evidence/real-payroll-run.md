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
mismatch. Including the shape and the six extra findings below, it scores
**18 of 18** — the employee-year-agency key among them.

### Six more it found that the reference never thought to measure

Independently verified after the fact, all exact:

| Finding | Agent | Verified |
|---|---:|---:|
| `mid_init` entirely empty | 6,000 | 6,000 |
| Regular pay above zero with **zero regular hours** | 3,014 | 3,014 |
| `payroll_number` missing | 1,893 | 1,893 |
| Borough case-variant rows | 19 | 19 |
| Rows with **any** negative pay or hours | 223 | 223 |
| Repeated employee-year-agency key groups | 228 rows / 112 groups | 228 / 112 |

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

## Every message and tool call from the run

The sections above quote and summarize; this is the turn's own output, in order,
so the quotations can be checked against their source rather than taken on trust.
Sandbox paths are elided; nothing else is edited.


### root agent — +4.5s

I’ll treat “clean” as analysis-ready payroll data with preserved monetary fidelity, explicit cross-column reconciliation, and no silent row loss. I’ll first copy and fingerprint the source, check for an applicable recipe, then run one reproducible profiling script and write its detailed artifacts to the sandbox.

### root agent — tool call `exec` — +4.5s

```json
{"intent":"Download a sandbox copy, inspect available cleaning guidance and recipes, and fingerprint the source file.","command":"set -euo pipefail\nmkdir -p work/nyc_payroll\ncurl -fL 'https://raw.githubusercontent.com/sreenathmmenon/cleanroom/feat/real-financial-corpus/data/samples/nyc_payroll_messy.csv' -o work/nyc_payroll/nyc_payroll_messy.csv\nprintf '%s\\n' '--- file ---'\nwc -l -c work/nyc_payroll/nyc_payroll_messy.csv\nshasum -a 256 work/nyc_payroll/nyc_payroll_messy.csv\nprintf '%s\\n' '--- available skill files ---'\nfind skills -maxdepth 4 -type f -name 'SKILL.md' -print 2>/dev/null | sort | head -100\nprintf '%s\\n' '--- csv header and sample ---'\nhead -n 3 work/nyc_payroll/nyc_payroll_messy.csv","cwd":""}
```

### root agent — tool call `exec` — +18.3s

```json
{"intent":"Check the delivery repository for the full cleaning skill and any NYC payroll recipe before profiling.","command":"set -euo pipefail\nbase='https://raw.githubusercontent.com/sreenathmmenon/cleanroom/feat/real-financial-corpus'\nfor p in \\\n  skills/data-cleaning/SKILL.md \\\n  skills/recipes/nyc-payroll/SKILL.md \\\n  skills/recipes/nyc_payroll/SKILL.md \\\n  skills/recipes/nyc-payroll-messy/SKILL.md; do\n  code=$(curl -sS -L -o \"work/nyc_payroll/$(echo \"$p\" | tr '/' '_')\" -w '%{http_code}' \"$base/$p\")\n  printf '%s %s\\n' \"$code\" \"$p\"\n  if [ \"$code\" != 200 ]; then rm -f \"work/nyc_payroll/$(echo \"$p\" | tr '/' '_')\"; fi\ndone\nif [ -f work/nyc_payroll/skills_data-cleaning_SKILL.md ]; then\n  printf '%s\\n' '--- cleaning skill headings ---'\n  grep -E '^#{1,3} ' work/nyc_payroll/skills_data-cleaning_SKILL.md | head -80\nfi","cwd":""}
```

### root agent — tool call `exec` — +22.8s

```json
{"intent":"Read the repository’s cleaning methodology so the profiler and plan follow its exact checks.","command":"cat work/nyc_payroll/skills_data-cleaning_SKILL.md","cwd":""}
```

### root agent — tool call `get_current_datetime` — +32.2s

```json
{}
```

### root agent — +86.5s

No attached recipe was present, so I checked the repository’s raw recipe paths; none matched this dataset. I did retrieve the full `data-cleaning` skill from the source branch. I’m now running the profile against the untouched sandbox copy, including pay-basis-specific arithmetic tests and pairwise consistency checks among salary, hours, regular pay, overtime, and other pay.

### root agent — tool call `exec` — +86.5s

```json
{"intent":"Create and run a reproducible full-profile script, saving detailed metrics and machine-readable findings.","command":"cat > work/nyc_payroll/profile.py <<'PY'\nfrom __future__ import annotations\nimport pandas as pd, numpy as np, re, json, hashlib\nfrom pathlib import Path\nfrom collections import defaultdict\n\nROOT=Path('work/nyc_payroll')\nSRC=ROOT/'nyc_payroll_messy.csv'\nNOW=pd.Timestamp('2026-08-29')\nraw=pd.read_csv(SRC,dtype=str,keep_default_na=True)\n# empty/whitespace are semantically null for profiling\nraw=raw.apply(lambda s: s.map(lambda x: np.nan if isinstance(x,str) and x.strip()=='' else x))\n\nmoney_cols=['base_salary','regular_gross_paid','total_ot_paid','total_other_pay']\nhours_cols=['regular_hours','ot_hours']\nnum_cols=['fiscal_year','payroll_number']+money_cols+hours_cols\n\ndef parse_num_val(x):\n    if pd.isna(x): return np.nan\n    s=str(x).strip(); neg=s.startswith('(') and s.endswith(')')\n    suffix=1\n    m=re.search(r'(?i)([kmb])(?:\\s*(?:usd|dollars?))?$',s)\n    if m:\n        suffix={'k':1e3,'m':1e6,'b':1e9}[m.group(1).lower()]; s=s[:m.start()]\n    s=re.sub(r'(?i)\\b(?:usd|dollars?|hrs?|hours?)\\b','',s)\n    s=re.sub(r'[$£€,%\\s,()]','',s)\n    try: v=float(s)*suffix\n    except: return np.nan\n    return -v if neg else v\nnum={c:raw[c].map(parse_num_val) for c in num_cols}\n\ndef fmt_num(x): return None if pd.isna(x) else float(x)\ndef samples(mask, cols, n=5):\n    idx=raw.index[mask][:n]\n    return [dict(row_index=int(i)+2, **{c:(None if pd.isna(raw.at[i,c]) else str(raw.at[i,c])) for c in cols}) for i in idx]\n\nlines=[]; findings=[]\ndef out(s=''): lines.append(str(s))\ndef add(issue,col,mask_or_count,sample_values,fix,severity='review'):\n    if isinstance(mask_or_count,(pd.Series,np.ndarray)):\n        count=int(np.asarray(mask_or_count).sum())\n    else: count=int(mask_or_count)\n    if count:\n        findings.append(dict(issue_type=issue,column=col,affected_rows=count,sample_values=sample_values,suggested_fix
```

### root agent — tool call `exec` — +90.0s

```json
{"intent":"Install the tabular analysis dependency in the sandbox environment, then rerun the saved profiler.","command":"set -euo pipefail\npip install -q pandas\npython work/nyc_payroll/profile.py > work/nyc_payroll/profile_stdout.txt\nprintf '%s\\n' 'Profile completed.'\nwc -l work/nyc_payroll/profile_report.txt work/nyc_payroll/findings.csv\nprintf '%s\\n' '--- cross-column section ---'\nsed -n '/CROSS-COLUMN/,/OUTLIERS/p' work/nyc_payroll/profile_report.txt\nprintf '%s\\n' '--- variant candidates ---'\ncat work/nyc_payroll/category_variant_candidates.json","cwd":""}
```

### root agent — tool call `exec` — +111.6s

```json
{"intent":"Review the profiler’s complete measured output and sorted findings before formulating clarifications and a repair plan.","command":"printf '%s\\n' '--- full measured profile ---'\ncat work/nyc_payroll/profile_report.txt\nprintf '%s\\n' '--- sorted findings ---'\npython - <<'PY'\nimport pandas as pd\np='work/nyc_payroll/findings.csv'\nd=pd.read_csv(p)\nprint(d[['issue_type','column','affected_rows','severity']].to_string(index=False))\nPY","cwd":""}
```

### root agent — +121.4s

The initial profile completed successfully. Because two categorical columns contain canonicalization candidates, I’m delegating only that mapping review as required; I’ll preserve every ambiguity it flags and combine those with the arithmetic and deduplication decisions into one clarification round.

### root agent — tool call `create_sub_agent` — +121.4s

```json
{"name":"category-canonicalization-review","input":"Analyze category canonicalization for an NYC payroll CSV profile. Return ONLY: (1) proposed explicit canonical map per column, (2) exact row count each map would change, and (3) every variant you judge genuinely ambiguous. Do not perform or suggest other data cleaning. Counts and values:\n\nagency_name (70 distinct): DEPT OF ED PEDAGOGICAL 926; DEPT OF ED PER SESSION TEACHER 715; POLICE DEPARTMENT 602; DEPT OF ED PARA PROFESSIONALS 553; DEPARTMENT OF EDUCATION ADMIN 307; Police Department 293; DEPT OF ED HRLY SUPPORT STAFF 293; FIRE DEPARTMENT 263; BOARD OF ELECTION POLL WORKERS 211; HRA/DEPT OF SOCIAL SERVICES 179; DEPARTMENT OF CORRECTION 146; NYC HOUSING AUTHORITY 145; DEPT OF HEALTH/MENTAL HYGIENE 140; DEPT OF PARKS & RECREATION 134; DEPARTMENT OF SANITATION 117; DEPT OF ED PER DIEM TEACHERS 115; DEPT OF ENVIRONMENT PROTECTION 108; DEPARTMENT OF TRANSPORTATION 80; ADMIN FOR CHILDREN'S SVCS 68; COMMUNITY COLLEGE (LAGUARDIA) 46; COMMUNITY COLLEGE (QUEENSBORO) 45; DEPARTMENT OF FINANCE 33; DEPARTMENT OF BUILDINGS 33; COMMUNITY COLLEGE (MANHATTAN) 33; COMMUNITY COLLEGE (KINGSBORO) 32; COMMUNITY COLLEGE (BRONX) 29; OFFICE OF THE COMPTROLLER 28; DEPT OF INFO TECH & TELECOMM 25; DISTRICT ATTORNEY-MANHATTAN 23; LAW DEPARTMENT 21; DISTRICT ATTORNEY QNS COUNTY 20; DISTRICT ATTORNEY KINGS COUNTY 19; OFFICE OF MANAGEMENT & BUDGET 17; HOUSING PRESERVATION & DVLPMNT 16; COMMUNITY COLLEGE (HOSTOS) 14; OFFICE OF THE MAYOR 13; NYC EMPLOYEES RETIREMENT SYS 13; DEPT OF CITYWIDE ADMIN SVCS 13; ADMIN TRIALS AND HEARINGS 12; BRONX DISTRICT ATTORNEY 9; DEPARTMENT OF PROBATION 9; TECHNOLOGY & INNOVATION 8; Manhattan DA 7; Kings DA 7; Bronx DA 7; CAMPAIGN FINANCE BOARD 6; DEPT. OF DESIGN & CONSTRUCTION 6; BOROUGH PRESIDENT-BROOKLYN 6; DEPT. OF HOMELESS SERVICES 6; DEPARTMENT FOR THE AGING 6; CITY COUNCIL 5; TAXI & LIMOUSINE COMMISSION 5; Queens DA 4; BOARD OF ELECTION 3; HUNTER COLLEGE HIGH SCHOOL 3; PUBLIC SERVICE CORPS 3; OFFICE OF C
```

### subagent 0211836c — +128.3s

1. **Proposed explicit canonical map**
   - `agency_name`
     - `"Police Department"` → `"POLICE DEPARTMENT"`
   - `work_location_borough`
     - `"Manhattan"` → `"MANHATTAN"`
     - `"Queens"` → `"QUEENS"`
     - `"Bronx"` → `"BRONX"`
     - `"Richmond"` → `"RICHMOND"`

2. **Exact row count changed**
   - `agency_name`: **293**
   - `work_location_borough`: **19**

3. **Genuinely ambiguous variants**
   - `"DISTRICT ATTORNEY-MANHATTAN"` (23), `"Manhattan DA"` (7)
   - `"DISTRICT ATTORNEY QNS COUNTY"` (20), `"Queens DA"` (4)
   - `"DISTRICT ATTORNEY KINGS COUNTY"` (19), `"Kings DA"` (7)
   - `"BRONX DISTRICT ATTORNEY"` (9), `"Bronx DA"` (7)
   - `"DISTRICT ATTORNEY RICHMOND COU"` (1), `"Richmond DA"` (1)
   - `"Spec Narcs-DA"` (1)

### root agent — tool call `exec` — +151.8s

```json
{"intent":"Generate representative row previews and stratified integrity counts needed for one-round clarification and the approval plan.","command":"cat > work/nyc_payroll/clarification_evidence.py <<'PY'\nimport pandas as pd, numpy as np, re\nfrom pathlib import Path\nR=Path('work/nyc_payroll'); d=pd.read_csv(R/'nyc_payroll_messy.csv')\nnumc=['base_salary','regular_hours','regular_gross_paid','ot_hours','total_ot_paid','total_other_pay']\nfor c in numc:d[c]=pd.to_numeric(d[c],errors='coerce')\nrows=[]\ndef section(name,df,n=5):\n    rows.append(f'## {name}\\ncount: {len(df)}\\n')\n    rows.append(df.head(n).to_markdown(index=True)+\"\\n\")\n# category previews\nsection('Agency case variant to canonicalize',d[d.agency_name.eq('Police Department')],[ ] if False else 5)\nsection('Borough case variants to canonicalize',d[d.work_location_borough.isin(['Manhattan','Queens','Bronx','Richmond'])],5)\n# key duplicates\nnorm=lambda s:s.fillna('').astype(str).str.strip().str.lower().str.replace(r'[^a-z0-9]','',regex=True)\nk=pd.DataFrame({'fy':d.fiscal_year,'a':norm(d.agency_name),'l':norm(d.last_name),'f':norm(d.first_name),'m':norm(d.mid_init)})\ndup=k.duplicated(False)\nshow=d[dup].copy(); show['_key']=list(map(tuple,k[dup].values)); show=show.sort_values('_key')\nsection('Repeated candidate employee-year key',show[['fiscal_year','agency_name','last_name','first_name','title_description','pay_basis','regular_hours','regular_gross_paid','ot_hours','total_ot_paid']],10)\n# negatives combined\nneg=d[numc].lt(0).any(axis=1)\nsection('Rows with any negative pay or hours',d[neg][['fiscal_year','agency_name','last_name','pay_basis']+numc],8)\n# pay checks\nchecks={\n'regular pay positive, zero regular hours':(d.regular_gross_paid>0)&(d.regular_hours==0),\n'OT pay positive, zero OT hours':(d.total_ot_paid>0)&(d.ot_hours==0),\n'OT hours positive, zero OT pay':(d.ot_hours>0)&(d.total_ot_paid==0),\n'negative derived total cash':(d.regular_gross_paid+d.total_ot_paid+d.total_other_pay
```

### root agent — tool call `exec` — +156.2s

```json
{"intent":"Correct the preview script’s duplicate-key call and regenerate the measured clarification evidence.","command":"set -euo pipefail\npython - <<'PY'\np='work/nyc_payroll/clarification_evidence.py'\ns=open(p).read().replace(\"dup=k.duplicated(False)\",\"dup=k.duplicated(keep=False)\")\nopen(p,'w').write(s)\nPY\npython work/nyc_payroll/clarification_evidence.py > work/nyc_payroll/clarification_evidence_stdout.txt\ncat work/nyc_payroll/clarification_evidence.md","cwd":""}
```

### root agent — +184.4s

## PROFILE summary

**Fingerprint:** 6,000 rows × 17 columns, SHA-256 `fa81f5f60b2201097b2ab5e1fc785bb22602c96c2bce8a3b09390d8cc231932a`. The original URL was copied to the sandbox and was not modified. No matching recipe was found; the raw repository copy of `skills/data-cleaning/SKILL.md` was used.

| Finding | Affected rows | Interpretation |
|---|---:|---|
| `mid_init` null | 6,000 | Entire column is empty |
| Positive regular pay with zero regular hours | 3,014 | Widespread across every pay basis; likely reporting semantics, not safely repairable |
| `payroll_number` null | 1,893 | Concentrated in 2014–2017; 2015–2017 are entirely null |
| Positive OT pay with zero OT hours | 1,068 | Widespread; no defensible hours imputation |
| Per-hour `regular_gross ≠ base_salary × hours` by >$1 | 762/864 | Often includes poll workers with a placeholder `$1` rate and zero hours; recomputation would corrupt pay |
| `work_location_borough` null | 657 | All 657 occur in 2014 |
| Agency case variant | 293 | `Police Department` → `POLICE DEPARTMENT` |
| Repeated candidate employee-year key | 228 rows / 112 groups | Samples show legitimate simultaneous jobs/pay bases; collapsing would remove 116 rows |
| Any negative pay or hours | 223 distinct rows | Includes payroll adjustments; 79 have negative derived cash pay |
| Near-full-year annual regular pay differs >10% from base | 161 | Base rate is not a reliable gross-pay formula |
| Negative `regular_gross_paid` | 114 | Reviewable adjustments |
| Negative `total_other_pay` | 123 | Reviewable adjustments |
| Negative `regular_hours` / `ot_hours` | 36 / 12 | Potential reversal/adjustment entries |
| OT pay inconsistent with broad stated-base bounds | 23 | Requires contract/effective-rate data to adjudicate |
| Borough case variants | 19 | Four unambiguous uppercase mappings |
| OT hours positive with zero OT pay | 6 | Cannot infer pay safely |
| Start date after June 30 of stated fiscal year | 2 | Fiscal-year semantics need authoritative interpretation |
| Exact duplicates / fully-null rows / unparseable dates | **0 / 0 / 0** | Clean checks |

**Dates:** all 6,000 are parseable ISO timestamps, range 1957-09-05 to 2025-06-02; none is future-dated.  
**Numeric text:** all numeric fields are fully parseable; no currency symbols, thousands separators, suffixes, or parentheses negatives.  
**Derived cash:** `regular + OT + other` ranges from **−$37,871.76 to $403,109.75**; there is no stored total column against which to assert equality.

The category review was delegated. It confirmed the 293 agency-case and 19 borough-case mappings, and flagged DA long/short names as genuinely ambiguous.

Detailed artifacts already written:

```sandbox_artifacts
[Full measured profile](<sandbox>/profile_report.txt)
[Sorted findings CSV](<sandbox>/findings.csv)
[Row-level clarification evidence](<sandbox>/clarification_evidence.md)
```

### root agent — tool call `ask_user_question` — +184.4s

```json
{"question":"How should the pay/hour anomalies be handled? There is no authoritative formula: base salary is a rate, gross pay reflects partial periods/rate changes, and zero hours are widespread. This choice also governs the 223 rows with negatives, 79 negative derived totals, 1,068 OT-pay/zero-hour rows, six OT-hour/zero-pay rows, and two start-date/fiscal-year flags.","options":["Preserve all source pay/hour values and rows; document every integrity flag without claiming the amounts are repaired (Recommended)","Exclude the 223 rows containing any negative pay or hours from the cleaned main file; preserve all other flagged values","Overwrite the 762 per-hour regular-gross mismatches using base_salary × regular_hours; preserve other flagged values"]}
```

### root agent — tool call `ask_user_question` — +184.4s

```json
{"question":"How should the 228 rows in 112 repeated employee-year key groups be treated? Samples show separate titles or pay bases for the same employee-year; there are no exact duplicates.","options":["Retain all 228 rows; treat the candidate key as non-unique (Recommended)","Keep the most complete row per group and drop 116 rows","Keep the highest-derived-cash row per group and drop 116 rows"]}
```

### root agent — tool call `ask_user_question` — +184.4s

```json
{"question":"Which categorical normalization should be applied? The delegated review marked DA long/short labels as ambiguous.","options":["Normalize only unambiguous case variants: 293 agency rows and 19 borough rows; keep all DA labels distinct (Recommended)","Also merge 26 short DA labels into their borough-specific long DA labels; leave “Spec Narcs-DA” distinct","Make no categorical changes"]}
```

### root agent — tool call `ask_user_question` — +184.4s

```json
{"question":"How should structural nulls be handled: all-null `mid_init`, 1,893 missing payroll numbers concentrated in 2014–2017, and 657 missing boroughs all in 2014? No evidence supports imputation.","options":["Preserve all columns, rows, and nulls; document their year-specific structural pattern (Recommended)","Drop the all-null mid_init column; preserve payroll-number and borough nulls","Drop every row missing payroll_number or borough (2,550 row-condition hits; union count will be measured before planning)"]}
```

### root agent — tool call `ask_user_question` — +184.4s

```json
{"question":"All 6,000 start dates are valid midnight ISO timestamps. Which export representation do you want?","options":["Normalize to ISO date YYYY-MM-DD, removing the redundant midnight time (Recommended)","Preserve the original ISO timestamp strings exactly"]}
```


## Reproducing this

```bash
npm run score:payroll
```

It first verifies the corpus SHA-256 matches the file this run was measured
against, then checks the reference JSON records that same fingerprint, then
recomputes all eighteen values and compares them with what the agent reported.
Any drift — including a corpus edit that leaves every aggregate unchanged —
exits non-zero.
