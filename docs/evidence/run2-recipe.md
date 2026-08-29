# Run 2 — the recipe does the asking for you

The first run on this data source cost the user five questions. This is the
second run: a fresh export, same schema, with the recipe from run 1 in place.

It asked **one** question where run 1 asked five — and it is a different
question.

Scope of this evidence, stated up front: the capture ends at that first pause,
which is where the run stops for a human. It shows which questions the recipe
removed and which escalation it raised; it does not show the subsequent apply,
verify, and deliver phases, because those wait on the answer. The end-to-end
apply-and-verify cycle is evidenced separately in the
[flagship run](flagship-run.md).

- Recipe: `skills/recipes/sales-export/SKILL.md`, learned from run
  `01m16gcpa4tyfvm1v87j97gezp` (the run that produced
  [PR #4](https://github.com/sreenathmmenon/cleanroom/pull/4))
- Export: `data/samples/sales_export_messy_week2.csv` — 15 rows, same 9 columns
- Session `01m17axsamdj040x45bfhb9dx9`, turn `01m17axsb41tfqvq8e50kx1skm`
- **71 seconds**, 16 events

The local sandbox cannot install git skills, so the agent used the documented
raw-URL fallback and said so.

## Recognition, then silence about the known

> The export fingerprint is SHA-256 `a3d4cdee…b53244`. It contains 15 data rows
> and 9 columns. I found the recipe at the user-supplied raw GitHub URL; it
> identifies itself as `recipe-sales-export`, created from run
> `01m16gcpa4tyfvm1v87j97gezp` and tied to PR #4. I'm now validating its
> reproducible schema signature and running the full profile; no policy has been
> applied yet.

> The schema signature matches exactly: `d97e2515…b0b83f`, so the recipe is
> applicable. Its confirmed policies will be carried into the plan without
> re-confirmation.

The agent announced the recipe with its provenance and verified the signature
**before** using any policy. Nothing was asked about dates, duplicates, currency
formatting, or the known region and status variants — all of which are in this
file, and all of which a human already decided on run 1.

## What it did ask about

Two things fell outside the recipe, and the agent found both — including one
this test did not plant:

> Profiling found two recipe escalation items that remain outside automatic
> coverage: this is a 15-row export versus the recipe's measured 34–50-row
> range, and `region=southwest` appears once but is absent from the confirmed
> region map.

The `southwest` value is the planted escalation. The **row count** is the one
worth noting: the recipe records `42 ± 20%` as a measured bound from its
creating run, and a 15-row file falls outside it. Nobody scripted that check
into this test — the recipe carried the number, and the agent enforced it.

Both went into a single question:

Verbatim, including one error — the order number is wrong, and is annotated
below the block:

```json
{
  "question": "Two recipe escalation items need one decision: the schema matches, but this export has 15 rows (below the recipe's 34–50 measured range), and order 1051 has the new region label `southwest`. How should I plan the run?",
  "options": [
    "Accept the smaller export and canonicalize `southwest` → `Southwest` (Recommended)",
    "Accept the smaller export and preserve `southwest` exactly as-is",
    "Do not use the standing recipe; treat this as a first-run cleaning review"
  ]
}
```

The third option is the one that matters: the agent offers to abandon its own
recipe and start fresh. A standing policy is a convenience it will give up, not
a position it defends.

**⚠️ The order number in that question is wrong.** It says `1051` carries
`southwest`. It does not — `southwest` is on order **1048**; order 1051 is
`East`. The quote above is reproduced unedited because it is the record of what
the agent actually said, not because the number is right. The count (one row) and the value are right, and nothing was applied,
so no data was affected; but the decision record points at the wrong source row,
and a user answering this question would have looked up the wrong order. The
escalation fired correctly and the identification did not. Worth stating plainly:
the mechanism that catches unseen values is reliable here, the row reference in
the prose is not, and only the first of those is load-bearing for safety.

## Delegation still happened, and still escalated

The canonicalization subagent ran on its own thread (events 10–13) and returned
a map that marks the unseen value rather than resolving it:

```
region: NYC → NYC; n-y-c → NYC; New York → NYC; East → East;
        west → West; West → West; southwest → ESCALATE
status: shipped → shipped; SHIPPED → shipped; Shipped → shipped;
        Pending → pending; pending → pending

rows changed — region: 3   status: 5
genuinely ambiguous — region: southwest (1 row); status: none
```

Note `New York → NYC` applied silently here. On run 1 the same subagent flagged
it as genuinely ambiguous and the user resolved it; the recipe records that
decision with its provenance, so run 2 does not ask again. That is the whole
feature in one line: **the question is asked once, by a human, and remembered.**

## Event ledger


| # | t | event | thread |
|---:|---:|---|---|
| 1 | +0.0s | `turn.created` | — |
| 2 | +6.3s | `model.message` | main |
| 3 | +13.8s | `sandbox.created` | — |
| 4 | +13.8s | `tool.response` | main |
| 5 | +20.0s | `model.message` | main |
| 6 | +20.0s | `tool.response` | main |
| 7 | +50.5s | `model.message` | main |
| 8 | +50.7s | `tool.response` | main |
| 9 | +56.0s | `model.message` | main |
| 10 | +56.0s | `thread.created` | sub:1603d870 |
| 11 | +63.4s | `model.message` | sub:1603d870 |
| 12 | +63.4s | `tool.response` | main |
| 13 | +63.4s | `thread.done` | sub:1603d870 |
| 14 | +70.8s | `model.message` | main |
| 15 | +70.8s | `tool.response_required` | main |
| 16 | +70.8s | `turn.done` | — |

Total 16 events over +70.8s.


Sixteen events against run 1's much longer cycle, and one
`tool.response_required` instead of five.

## Transcript


### root agent — +6.3s

I’ll fetch the export and recipe into a sandbox workspace, fingerprint the source, validate the recipe’s schema signature before using any policy, then profile the file. I’ll ask only about ambiguities not resolved by the recipe and will stop after presenting the approval-gated plan.

### root agent — tool call `exec` — +6.3s

```json
{"intent":"Fetch the source export and its documented cleaning recipe, then fingerprint the untouched sandbox copy.","command":"set -euo pipefail\nmkdir -p cleanroom_week2/source cleanroom_week2/work\ncurl -fsSL 'https://raw.githubusercontent.com/sreenathmmenon/cleanroom/feat/recipe-run2/data/samples/sales_export_messy_week2.csv' -o cleanroom_week2/source/sales_export_messy_week2.csv\ncurl -fsSL 'https://raw.githubusercontent.com/sreenathmmenon/cleanroom/feat/recipe-run2/skills/recipes/sales-export/SKILL.md' -o cleanroom_week2/source/SALES_EXPORT_RECIPE.md\ncp cleanroom_week2/source/sales_export_messy_week2.csv cleanroom_week2/work/sales_export_messy_week2.working.csv\nprintf '%s\\n' '--- fingerprint ---'\nwc -l -c cleanroom_week2/source/sales_export_messy_week2.csv\nshasum -a 256 cleanroom_week2/source/sales_export_messy_week2.csv\nprintf '%s\\n' '--- recipe ---'\ncat cleanroom_week2/source/SALES_EXPORT_RECIPE.md","cwd":"."}
```

### root agent — tool call `get_current_datetime` — +20.0s

```json
{}
```

### root agent — +50.5s

The export fingerprint is SHA-256 `a3d4cdee…b53244`. It contains 15 data rows and 9 columns (the line count includes the header). I found the recipe at the user-supplied raw GitHub URL; it identifies itself as `recipe-sales-export`, created from run `01m16gcpa4tyfvm1v87j97gezp` and tied to PR #4. I’m now validating its reproducible schema signature and running the full profile; no policy has been applied yet.

### root agent — tool call `exec` — +50.5s

```json
{"intent":"Validate the recipe signature and produce a complete, evidence-based profile of the new export.","command":"cat > cleanroom_week2/profile.py <<'PY'\nimport csv, hashlib, json, re\nfrom collections import Counter, defaultdict\nfrom datetime import datetime, date\nfrom decimal import Decimal, InvalidOperation\nfrom pathlib import Path\n\nSRC=Path('cleanroom_week2/source/sales_export_messy_week2.csv')\nTODAY=date(2026,8,29)\nEXPECTED_COLS=[('order_id','integer'),('order_date','date'),('customer','string'),('region','string'),('product','string'),('qty','integer'),('unit_price','decimal'),('total','decimal'),('status','string')]\nEXPECTED_SIG='d97e251524eb476fc06def2aea3e53c138d31b1409d7a2b28ba614bc41b0b83f'\n\ndef norm_name(s): return re.sub(r'\\s+',' ',s.strip().lower())\ndef signature(pairs):\n    payload='\\n'.join(f'{norm_name(n)}:{t}' for n,t in pairs)\n    return hashlib.sha256(payload.encode()).hexdigest(), payload\n\ndef blank(v): return v is None or not str(v).strip()\ndef money(v):\n    if blank(v): return None\n    s=str(v).strip(); neg=s.startswith('(') and s.endswith(')')\n    if neg: s=s[1:-1]\n    s=re.sub(r'(?i)USD','',s).strip()\n    s=re.sub(r'[$€£¥,]','',s).strip()\n    try: x=Decimal(s)\n    except InvalidOperation: return 'INVALID'\n    return -x if neg else x\n\ndef integer(v):\n    x=money(v)\n    if x in (None,'INVALID'): return x\n    return int(x) if x==x.to_integral_value() else 'INVALID'\n\ndef parse_date(v):\n    if blank(v): return None,None\n    s=str(v).strip()\n    for fmt,label in [('%Y-%m-%d','ISO'),('%b %d %Y','text_Mon_DD_YYYY'),('%d %b %Y','text_DD_Mon_YYYY')]:\n        try:return datetime.strptime(s,fmt).date(),label\n        except ValueError:pass\n    if re.fullmatch(r'\\d{1,2}/\\d{1,2}/\\d{4}',s):\n        try:return datetime.strptime(s,'%d/%m/%Y').date(),'slash_day_first'\n        except ValueError:return None,'slash_invalid_day_first'\n    return None,'unparsed'\n\nwith SRC.open(newline='',encoding='utf-8-sig') as 
```

### root agent — +56.0s

The schema signature matches exactly: `d97e2515…b0b83f`, so the recipe is applicable. Its confirmed policies will be carried into the plan without re-confirmation. Profiling found two recipe escalation items that remain outside automatic coverage: this is a 15-row export versus the recipe’s measured 34–50-row range, and `region=southwest` appears once but is absent from the confirmed region map. I’m completing the required delegated category review before asking one consolidated clarification.

### root agent — tool call `create_sub_agent` — +56.0s

```json
{"name":"category-review","input":"Analyze category canonicalization only for a 15-row sales CSV. Return ONLY: (1) proposed canonical map per column, (2) number of rows each mapping changes, and (3) genuinely ambiguous variants. Do not inspect files or call tools; use these measured counts and standing policies.\n\nregion counts: NYC 4, n-y-c 1, East 5, west 1, New York 1, southwest 1, West 2.\nConfirmed recipe region policy: nyc/n-y-c/New York -> NYC; west -> West; East unchanged; canonical outputs NYC and West are accepted. Any unseen value must be escalated. New York -> NYC was previously human-resolved.\n\nstatus counts: shipped 9, SHIPPED 3, Pending 1, Shipped 1, pending 1.\nConfirmed recipe status policy: lowercase every status label; cancelled unchanged. Unseen semantic labels must be noted only if the policy cannot handle them."}
```

### subagent 1603d870 — +63.4s

1. **Proposed canonical map**
   - **region:** `NYC → NYC`; `n-y-c → NYC`; `New York → NYC`; `East → East`; `west → West`; `West → West`; `southwest → ESCALATE`
   - **status:** `shipped → shipped`; `SHIPPED → shipped`; `Shipped → shipped`; `Pending → pending`; `pending → pending`

2. **Rows changed**
   - **region:** `n-y-c → NYC`: 1; `New York → NYC`: 1; `west → West`: 1. **Total: 3**
   - **status:** `SHIPPED → shipped`: 3; `Shipped → shipped`: 1; `Pending → pending`: 1. **Total: 5**

3. **Genuinely ambiguous variants**
   - **region:** `southwest` (1 row)
   - **status:** none

### root agent — tool call `ask_user_question` — +70.8s

```json
{"question":"Two recipe escalation items need one decision: the schema matches, but this export has 15 rows (below the recipe’s 34–50 measured range), and order 1051 has the new region label `southwest`. How should I plan the run?","options":["Accept the smaller export and canonicalize `southwest` → `Southwest` (Recommended)","Accept the smaller export and preserve `southwest` exactly as-is","Do not use the standing recipe; treat this as a first-run cleaning review"]}
```


## Reproducing this

```bash
npm run check:recipe-guard        # asserts the signature gate, exits non-zero if it breaks
npm run demo:recipe               # interactive: the one question pauses for you
npm run demo:recipe -- --auto     # unattended: halts on the escalation, exit 2
npm run demo:recipe -- --refuse   # the refusal path, against the renamed-column fixture
```

`check:recipe-guard` is the executable half of this evidence. It recomputes the
signature from the recipe's own documented derivation and asserts that the
recipe records that signature, that the week-2 export matches it, and that the
renamed-column fixture does not. A regression that let the recipe fire on the
wrong schema fails that third check.

---

# The refusal test — a recipe that does not apply

A recipe that fires on the wrong schema is worse than no recipe: it would apply
one data source's confirmed decisions to another and call the result verified.
So the signature check has to be a real gate, not a formality.

`data/samples/tests/week2_renamed_column.csv` is the same week-2 export with one
column renamed — `region` becomes `sales_region`. Everything else is identical.

- Session `01m17b1h434ttgtcmgnexyv872`, turn `01m17b1h4kcw0w3ep0hfkqkpdq`
- The agent was told a recipe exists and given its URL

It declined to use it.

> The schema check failed: the file's signature is `ab3f…544c`, not the recipe's
> `d97e…b83f`, because expected `region:string` is now `sales_region:string`.
> **Per the recipe, I will not apply it.**

And it explained the refusal in terms of the column, not the hash:

| Check | Incoming file | Recipe requirement | Decision |
|---|---|---|---|
| Schema signature | `ab3f7270…3ab544c` | `d97e2515…b0b83f` | **Mismatch — stop recipe** |
| Changed schema element | `sales_region:string` | `region:string` | Renamed column requires clarification |
| Row-count envelope | 15 rows | 34–50 rows | Escalation required |

That is why the recipe stores the column list beside the hash: two unequal
hashes tell a user nothing, and "the `region` column was renamed to
`sales_region`" tells them everything.

## It fell back to first-run behavior

Having refused the recipe, the agent profiled the file from scratch and proposed
nothing:

> **The recipe does not genuinely apply, so I did not apply it.** […] Suggested
> action — not applied.

The detail worth noticing is in the delegated analysis. On run 2 the subagent
applied `New York → NYC` silently, because the recipe recorded a human's
decision. Here, with the recipe refused, it flags the same value as ambiguous
again:

```
genuinely ambiguous:
  New York: Previously resolved to NYC, but ambiguous where city and state are distinct.
  southwest: New value; no evidence that it aliases another region, and its
             intended canonical casing is undetermined.
```

The confirmed policy did not leak across the signature boundary. A decision a
human made about *this* schema stays attached to that schema — which is exactly
what makes the recipe safe to trust on the files it does cover.
