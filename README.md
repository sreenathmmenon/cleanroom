# Cleanroom

**Drop in messy data. Get back data you trust.**

Cleanroom is an approval-gated data-repair agent built on
[TrueForge](https://trueforge.dev), TrueFoundry's open-source agent harness.
Hand it the spreadsheet nobody wants to touch — mixed date formats, duplicated
rows, currency-as-text, half-blank columns, wrong totals — and it profiles the
damage by running real pandas code in a sandbox, proposes a fix plan with
before/after previews, asks when a fix is ambiguous, and **waits for your
approval before anything destructive**. Out comes a clean file and a change
report that accounts for every row.

```
messy.csv ──▶ PROFILE ──▶ CLARIFY ──▶ PLAN ──▶ 🛑 APPROVAL GATE ──▶ APPLY ──▶ VERIFY ──▶ DELIVER ──▶ DISTILL
                (sandbox)  (ask-user)  (previews)   (human decides)    (sandbox)  (assertions)  (gated PR)  (recipe PR)
```

**▶ [Watch the 3-minute demo](https://youtu.be/AT2VMDGnKN0)** · **[Try it live](https://cleanroom-production.up.railway.app)** — no signup, open it and give it a file.

Built for [The Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge)
(WeMakeDevs × TrueFoundry, Aug 24–30, 2026).

---

### The 30-second version

It was pointed at two real public datasets it had never seen, with no description
of their defects — and scored against references measured by a separate script.

| | |
|---|---|
| [**NYC 311**](docs/evidence/real-world-run.md) — 5,000 rows × 44 columns | **9/9 checks exact.** Found 32 tickets closed *before* they were created, and **corrected the verification script three times** |
| [**NYC payroll**](docs/evidence/real-payroll-run.md) — 6,000 rows, real salaries | **18/18 checks exact.** Found 1,068 rows paid overtime for zero overtime hours |

Then it did the thing that matters. On its demo corpus, a stored `total` must
equal `qty × unit_price`, so a mismatch is an error and it recomputes. Real
payroll contains 762 rows with the **identical defect shape** —
`regular_gross_paid ≠ base_salary × regular_hours`. It refused:

> often includes poll workers with a placeholder `$1` rate and zero hours;
> **recomputation would corrupt pay** […] there is no stored total column against
> which to assert equality

`base_salary` is a *rate*, not an expected total. An agent that "reconciles" that
column silently rewrites thousands of people's pay. Its four questions about pay,
duplicates, categories and nulls all recommended **preserve and flag** — the
destructive option a naive cleaner picks by default was offered and not
recommended. The fifth, about export formatting, recommended normalizing
timestamps to `YYYY-MM-DD`.

**Every number above is re-checkable from a cold clone:**

```bash
npm run score:real-world   # 9/9 agent comparisons, 9/9 reference cross-checks
npm run score:payroll      # 20/20 agent comparisons, 11/11 reference cross-checks
```

Both recompute every figure from the corpus and compare it with what the agent
reported, including the 762 mismatches it refused to touch. Both verify the
corpus SHA-256 first, so they prove *these* numbers describe *this* data rather
than that some file matched, and both exit non-zero on any drift.

A third command, `npm run check:recipe-guard`, checks the schema signature that
decides whether a recipe may apply — arithmetic only, over column names and
types, not a live run. The agent actually declining a recipe is a separate,
recorded thing: `npm run demo:recipe -- --refuse`, transcript in
[`docs/evidence/run2-recipe.md`](docs/evidence/run2-recipe.md).

---

## Why this exists

Every team has a CSV export that three different people have hand-edited and
nobody dares import anywhere. Cleaning it is tedious, error-prone, and — when
done by a script — blind: it can't ask whether `03/04` means March 4 or April 3,
and it will happily drop rows you needed. Cleanroom's thesis is that data repair
is exactly the class of work an agent should do **only** behind a harness: real
code execution for evidence, a sandbox so nothing leaks, and a human gate
before anything irreversible.

## How it works

1. **Intake** — you attach the file and say what "clean" means (BI import, analysis, migration).
2. **Profile** — the agent writes and runs a profiling script in the TrueForge sandbox: nulls, duplicates, mixed date formats, currency-as-text, category variants, broken computed totals, impossible values. Every finding carries a measured count, not a guess.
3. **Clarify** — ambiguities that change the fix (date format, dedup rule, null policy) are asked in one round via `ask_user_questions`.
4. **Plan** — a numbered fix plan, each step labeled safe or **destructive**, with before/after previews and post-conditions.
5. **Approval gate** — the agent stops. You approve, edit, or reject the plan. This is the product, not a speed bump.
6. **Apply + Verify** — fixes run in the sandbox against a copy; a verification suite asserts row reconciliation, dtype/null post-conditions, and pipeline idempotence.
7. **Deliver** — the agent opens a **pull request** through the GitHub MCP server: a branch `cleanroom/delivery-<id>` carrying `exports/<id>/cleaned_<name>` and `exports/<id>/change_report.md`. Every write is individually approval-gated, and the PR is the paper trail a human reviews and merges — acceptance is your act, not the agent's. The cleaned file is named and located for you — in the pull request, and at its path in the sandbox. Your original is never modified.

## Why TrueForge (and not a script, and not a chatbot)

A script can't ask; a chatbot can't be trusted to execute. The harness is the
difference, and every capability below is load-bearing:

| TrueForge capability | What it does in Cleanroom |
|---|---|
| Sandbox-as-tool | All profiling/fixing code runs isolated via Daytona; the user's file is never at risk |
| Human checkpoints | GitHub MCP `@write`/`@destructive` tools require approval — every commit and the PR itself pass through the gate |
| `ask_user_questions` | One structured round of clarification instead of silent guesses |
| Generative UI | Enabled on the agent; findings and previews are emitted as structured tables the chat UI renders. The OpenUI block format is not documented, so this is the harness's default rendering rather than a custom component |
| Dynamic subagents | Category canonicalization is delegated to a focused subagent via `create_sub_agent`; the root agent receives the map, the counts, and any ambiguity flagged — not the analysis — [captured run](docs/evidence/subagent-run.md) |
| Skills (git-backed) | The `data-cleaning` methodology lives in `skills/data-cleaning/SKILL.md` in this repo — versioned, reviewable, reusable |
| Persistent sessions | A dataset's cleaning history survives across turns — refine instead of restart |
| Context management | Large profiling outputs offload to the sandbox instead of flooding context |

## Try it without installing anything

A deployed instance runs at
**[cleanroom-production.up.railway.app](https://cleanroom-production.up.railway.app)**
with the agent, its skill and its sandbox already configured. Open it, pick
Cleanroom from the Agents Library, and paste a corpus URL — for example
`https://raw.githubusercontent.com/sreenathmmenon/cleanroom/main/data/samples/sales_export_messy.csv`.

The full pipeline runs there, not just the UI:
[a hosted run](docs/evidence/hosted-run.md) executes profiling code in a Daytona
sandbox, delegates category analysis to a subagent, matches the stored recipe by
schema signature, and stops to ask. It also recovers from two of its own errors
mid-run and says exactly what did and did not touch the data.

That instance has **no login** — TrueForge's only auth is OIDC, which is
unavailable in the single-container mode this uses. It is a demo instance, torn
down after review. Run it locally for anything else; see
[`DEPLOY.md`](DEPLOY.md).

## Quickstart

Prereqs: Node 22+, a model API key, a free [Daytona](https://daytona.io) key.

```bash
git clone https://github.com/sreenathmmenon/cleanroom.git
cd cleanroom

./scripts/setup.sh          # launches TrueForge local mode on :8790
# In another terminal — the scripted path (secrets stay in local .env):
cp .env.example .env        # fill in MODEL_API_KEY, DAYTONA_API_KEY,
                            # and GITHUB_TOKEN (repo scope) for PR delivery
npm run setup:all           # configures providers + skill, then seeds the agent
#   GITHUB_TOKEN registers the GitHub MCP server. Without it, configure.mjs
#   skips that server and seed-agent.mjs drops it from the agent: profiling,
#   planning, the approval gate, and verification all still run, but the
#   pull-request delivery step is unavailable.
```

For the branded embed instead of the stock chat UI:

```bash
npm --prefix ui ci && npm --prefix ui run build
node scripts/serve-ui.mjs   # http://127.0.0.1:4174, /api proxied to TrueForge
```

Open the TrueForge chat UI → Agents Library → **Cleanroom** → Try, and attach
`data/samples/sales_export_messy.csv` — a realistic 42-row export planted with
exact duplicates from a double import, a near-duplicate, three date formats,
currency strings, region variants, nulls, a negative quantity, and wrong totals.

## Recipes — the agent learns the clean

The first run costs you five questions. The second should cost none.

After a delivery verifies green, Cleanroom asks one question: save what we
decided as a recipe for this data source? On yes, it computes a **schema
signature** (SHA-256 of the ordered column names and dtypes), writes the
confirmed policies as a skill at `skills/recipes/<slug>/SKILL.md`, and opens a
second pull request containing only that file.

**The human merge is the learning gate.** The agent cannot promote its own
policy — a person reviews what it claims to have learned, Qodo reviews it too,
and only a merge makes it standing behavior. Its memory is a pull request.

A recipe records only what a human actually confirmed, each line carrying its
provenance ("confirmed by user on run `<id>`, `<date>`"). Anything the agent
inferred but never asked about is filed as an open question, not a rule. Every
threshold is a measured number from the creating run, not a vibe.

On a later export, a matching signature means the confirmed fixes apply without
re-asking. But a recipe is a licence to stop asking about the **known**, never
about the **new**. The run stops and asks when:

- the schema signature does not match (a column added, removed, renamed, retyped);
- a category appears that is not in the canon map;
- the row count, null rate, or a step's blast radius falls outside recorded bounds;
- any verification assertion fails;
- the file contains anything the recipe is silent on.

`data/samples/sales_export_messy_week2.csv` is the second act: same schema,
issues the recipe already covers — and one region value, `southwest`, that it
has never seen.

[It works](docs/evidence/run2-recipe.md). Run 2 verified the signature, announced
the recipe with its provenance, and applied the confirmed policies **without
asking anything about dates, duplicates, currency, or the known regions** — the
five questions of run 1, gone. It reached its first pause in 71 seconds with one
question, and that question covered two escalations rather than one: the planted
`southwest` value, *and* a row count outside the recipe's own recorded
`42 ± 20%` bound. (The capture ends at that pause, which is where the run waits
for a human; the full apply-verify-deliver cycle is in the
[flagship run](docs/evidence/flagship-run.md). The agent also misnamed the row
carrying `southwest` — the evidence file records that.)
Nothing scripted that second check — the recipe carried the number and the agent
enforced it. Among the options it offered: abandon the recipe and treat this as a
first run. A standing policy is a convenience it will give up, not a position it
defends.

The same subagent that flagged `New York → NYC` as ambiguous on run 1 applied it
silently on run 2, because a human had since decided it and the recipe records
that decision with its provenance. The question is asked once, by a person, and
remembered.

The same rules hold unattended — including the one that matters most. A
scheduled run profiles the file, applies the recipe to a sandbox copy, verifies
it, and then **stops at the approval gate anyway**, because an unattended run has
nobody to approve it. It prepares the work and reports what is ready; a person
still decides. Anything outside the recipe stops it earlier still.

```bash
npm run recipe:schedule -- --url <csv-url> --recipe sales-export --cron "0 9 * * 1" --tz Asia/Kolkata
```

The recipe is named explicitly rather than matched by schema alone: two different
exports can share a schema, and applying one source's confirmed policies to
another is precisely the mistake the approval model exists to prevent. The named
recipe's signature is still checked against the file before anything is applied.

Schedules are created **paused** unless you pass `--active`, so nothing runs
before you have looked at it. One caveat, stated plainly: `/api/v1/schedules` is
part of the TrueForge API but is not served by every build — the current release
(0.1.4) returns 404, and the script says so rather than pretending. The agent's
scheduled-run rules live in `agent/instructions.md` and can be exercised today
with `npm run demo:recipe`, whose `--auto` mode halts on escalation exactly as an
unattended run must.

### Putting a merged recipe to work

Merging the recipe PR is the human decision; registering it is the mechanical
step after:

```bash
npm run recipe:register -- sales-export   # register the merged recipe as a skill
npm run seed                              # attach it to the agent
```

`seed` attaches every registered `recipe-*` skill, so the next run can match one.
Skills load progressively — TrueForge shows the agent only each skill's name and
description until one is relevant, so a shelf of recipes costs nothing until the
matching data source turns up. Where the sandbox cannot install git skills, the
agent falls back to reading `skills/recipes/<slug>/SKILL.md` by raw URL and says
which path it used.

See [`docs/recipe-template.md`](docs/recipe-template.md) for the exact structure
the agent fills in.

<a id="scale"></a>

## Does it hold up at size?

The 42-row corpus is small so you can check every number by hand. That is also
its limit, so there is a second corpus of **10,000 rows** — generated with a
fixed seed by `scripts/make_large_corpus.py`, which counts every issue *as it
plants it* and writes the counts to `data/samples/large_manifest.json`. The
profiling run is then scored against ground truth rather than believed.

**Twelve of twelve planted issue classes were detected exactly** — 41 duplicate
rows, **28 near-duplicates that share an order id and differ only in case and
whitespace**, 2,002 slash dates, 1,009 text dates, 68 broken totals, 12,426
thousands separators, 68 missing customers, 23 negative quantities, 27 `USD`
suffixes, and the nulls in each financial column — with no false positives, in
152 seconds. The near-duplicates are the ones a plain `drop_duplicates()`
misses, and the agent separated the 138 duplicate-key rows into 82 exact copies
and 56 cosmetic-only rows across 28 pairs, unprompted.

The category classes reconcile rather than tick: of 4,126 planted region
variants the canonical map would change 3,318, and the gap is `New York` — which
the agent **refused to fold into `NYC` without asking**, because it may be the
city or the state.

Profiling is size-independent because it is pandas in a sandbox, and the run
demonstrates the harness's context management doing real work: the per-row
detail went to sandbox files and only the summary table entered the
conversation. Full numbers and transcript in
[`docs/evidence/scale-run.md`](docs/evidence/scale-run.md).

```bash
python3 scripts/make_large_corpus.py   # regenerates the identical corpus + manifest
```
## Does it work on data nobody prepared for it?

The corpora above share a weakness worth naming: they were built here, so a
profiling run against them measures the agent against its author's imagination.

So it was pointed at 5,000 rows of
[NYC 311 Service Requests](https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9)
(CC0, public domain) — 44 columns of real municipal data — and told nothing about
what was wrong with it.

**Eight of eight independently measured checks, exact**, with no false positives
— reproducible with `npm run score:real-world`, which recomputes every reference
value from the corpus and exits non-zero on any mismatch.
Including the finding no synthetic corpus here models: **32 tickets closed
*before* they were created.**

Then it did the harder thing. Every one of those inversions is between 1 and 29
seconds, so the agent diagnosed them as **source precision artifacts and
recommended preserving them** — not repairing them. It read 1,203
resolution-update inversions the same way, from midnight-valued samples:
date-only granularity rather than corruption. Repairing real data means knowing which anomalies are errors and
which are how the source records the world.

And three of its numbers **corrected the verification script**. My reference
counted empty cells, so it scored `park_facility_name` as fully populated; the
agent saw that it is the literal string `Unspecified` in 4,997 rows and `N/A` in
3 — 100% missing, 0% empty. It was right about `police_precinct` (4,913
convertible labels, not 5,000 populated) and `location_type` (41 true case
variants, not 3,505 non-uppercase values) too. The reference in this repo was
corrected to match.

Full transcript, scoring table, and the ten-part clarification:
[`docs/evidence/real-world-run.md`](docs/evidence/real-world-run.md).

### And on real money?

311 data has no money in it, and the sales corpus's arithmetic defects were
planted by the same person who wrote the arithmetic checks. So the agent was also
pointed at 6,000 rows of
[NYC Citywide Payroll Data](https://data.cityofnewyork.us/City-Government/Citywide-Payroll-Data-Fiscal-Year-/k397-673e)
(CC0) — 70 agencies, 12 fiscal years, real salaries — with no description of its
defects.

**Eighteen of eighteen checks exact** (`npm run score:payroll`), including 1,068
rows paid overtime for zero overtime hours, 223 rows carrying negative pay or
hours, and six findings the reference script never thought to measure.

But the result that matters is what it **refused** to do. On the sales corpus a
stored `total` must equal `qty × unit_price`, so a mismatch is an error and the
agent recomputes it. Here, 762 per-hour rows have `regular_gross_paid ≠
base_salary × regular_hours` — and it declined to touch them:

> often includes poll workers with a placeholder `$1` rate and zero hours;
> **recomputation would corrupt pay** […] there is no stored total column against
> which to assert equality

`base_salary` is a *rate*, not an expected total; gross pay legitimately reflects
partial periods and mid-year changes. All five of its clarifying questions
recommended **preserve and flag**, and the option a naive cleaner would pick by
default — overwrite the 762 mismatches — was offered and not recommended.

Scoring table, the five questions, and every message and tool call from the run:
[`docs/evidence/real-payroll-run.md`](docs/evidence/real-payroll-run.md).

## Sample dataset

`data/samples/sales_export_messy.csv` is the demo corpus: deterministic,
self-explaining issues whose fixes make a compelling 3-minute walkthrough
(see `docs/demo-script.md`).

## Safety model

- The original file is read-only by construction — all work happens on a sandbox copy.
- Destructive steps (row drops, overwrites, exports) are individually labeled and gated.
- The verification suite must pass before success is claimed; a failed assertion halts the run.
- Nothing leaves the sandbox except files the user explicitly approved.
- Delivery is a pull request, not a silent overwrite: the cleaned file and its
  change report land on a branch for human review, and merging is the act of
  acceptance.

## Architecture

See `docs/architecture.md`. In one line: TrueForge agent ← instructions +
skill from this repo; sandbox for compute; GitHub MCP (approval-gated) for
delivery as a pull request; chat UI for interaction.

## Qodo Code Review Evidence

Every pull request in this repo is reviewed by [Qodo](https://www.qodo.ai) before
merge; no feature work reaches `main` directly. Review priorities are codified in
[`.pr-agent.toml`](.pr-agent.toml): secret hygiene, API correctness, determinism,
and whether the project still runs from a clean clone.

**Every merged pull request carries its review thread.** Findings were
fixed or argued in the thread before merge — Qodo updates its review in place, so
the response comment on each PR is the durable record of what was raised and what
was done about it.

The summary that matters: the valuable findings were not typos. They were
**claims outrunning their evidence** — features that could not have worked as
described, and verification that verified less than it advertised. Each one
changed the design.

### The findings that changed the product

| Finding | Why it mattered | Response |
|---|---|---|
| *"Ambiguous dates are silently guessed"* — [#1](https://github.com/sreenathmmenon/cleanroom/pull/1) | The agent was picking a date format on the user's behalf | Became **evidence-based inference**: a component > 12 proves the order, and with no proof the agent asks. Now the demo's signature behaviour |
| *"Recipes never reach agent"* — [#10](https://github.com/sreenathmmenon/cleanroom/pull/10) | Config registered only one fixed skill, so a merged recipe was invisible. The entire second-run story had no path from a merged file to a running agent | `recipe:register` + conditional attach of every `recipe-*` skill, with a documented raw-URL fallback |
| *"Merge provenance cannot exist"* — [#10](https://github.com/sreenathmmenon/cleanroom/pull/10) | The recipe template demanded each recipe state who merged it and when — facts that cannot exist inside the PR that introduces the file | Recipes record only what is knowable at authoring time; the merge is its own record |
| *"Approval gate blocks schedules"* — [#12](https://github.com/sreenathmmenon/cleanroom/pull/12) | A scheduled run has nobody to approve it, so the standing pipeline could not complete | Scheduled runs **prepare and stop**: profile, apply to a copy, verify, then wait. Auto-approving would have deleted the product to ship a feature |
| *"Refusal fixture tests nothing"* — [#14](https://github.com/sreenathmmenon/cleanroom/pull/14) | A fixture proving a refusal that no command executed | `npm run check:recipe-guard` + `demo:recipe --refuse`; verified to fail on regression |
| *"Scorer ignores corpus fingerprint"* — [#21](https://github.com/sreenathmmenon/cleanroom/pull/21) | The scorer proved *some* file produced those counts, not *the* file. Matching counts is not provenance | Both scorers now bind to the corpus SHA-256 and cross-check the reference JSON |
| *"Recorded reference values skipped"* — [#22](https://github.com/sreenathmmenon/cleanroom/pull/22) | The cross-check silently skipped values stored under a different shape — in a script whose only job is catching that | Every reference value mapped explicitly; a missing key is a failure, not a skip |

### Findings that corrected the documentation

Review findings on [#8](https://github.com/sreenathmmenon/cleanroom/pull/8) caught
the README claiming more than the repo could show, including a `:3000` port that
would have sent a fresh clone to the wrong server and a scale claim with no run
behind it. Two further corrections were **self-caught while verifying claims
against the code**, and shipped as their own PRs rather than being quietly
edited: a generative-UI rendering claim that could not be verified
([#13](https://github.com/sreenathmmenon/cleanroom/pull/13)), and a React pin
written up as fixing a bug it did not fix
([#16](https://github.com/sreenathmmenon/cleanroom/pull/16), found by opening the
UI in a browser). Those two reviews came back clean because the PRs existed to
retract the claims.

### A finding dismissed, with an argument

Not every finding is right. A security finding on
[#1](https://github.com/sreenathmmenon/cleanroom/pull/1) (classic-token scope)
was [dismissed in-thread with a written rotation argument](https://github.com/sreenathmmenon/cleanroom/pull/1#issuecomment-5461708004),
and Qodo's own alternative-approach note on
[#2](https://github.com/sreenathmmenon/cleanroom/pull/2) was
[answered by keeping the polling design it recommended](https://github.com/sreenathmmenon/cleanroom/pull/2#issuecomment-5461756405).

### The full trail

| PR | Subject | Review thread |
|---|---|---|
| [#1](https://github.com/sreenathmmenon/cleanroom/pull/1) | Scaffold, manifest, skill, corpus, seed pipeline | 4 review passes; 11 findings, 10 fixed + 1 argued |
| [#2](https://github.com/sreenathmmenon/cleanroom/pull/2) | Scripted demo with live approval gates | Alternative-approach note, answered |
| [#3](https://github.com/sreenathmmenon/cleanroom/pull/3) | Local-sandbox skill decoupling | 3 suggestions; 1 implemented, 2 deferred with reasons |
| [#5](https://github.com/sreenathmmenon/cleanroom/pull/5) | README evidence map | Clean |
| [#6](https://github.com/sreenathmmenon/cleanroom/pull/6) | Branded UI embed | Clean |
| [#7](https://github.com/sreenathmmenon/cleanroom/pull/7) | UI runtime: same-origin proxy, React 18 | Stream error handling, dev proxy, truncated-asset 200s |
| [#8](https://github.com/sreenathmmenon/cleanroom/pull/8) | README truthing, limitations, disclosure | Delivery credential, dangling anchor, unearned session claim |
| [#9](https://github.com/sreenathmmenon/cleanroom/pull/9) | Dynamic subagent delegation | Delegated ambiguities could be dropped |
| [#10](https://github.com/sreenathmmenon/cleanroom/pull/10) | DISTILL: recipes as pull requests | 6 findings — recipe loading, resume chaining, unattended guessing, schema hash, exit code, impossible provenance |
| [#11](https://github.com/sreenathmmenon/cleanroom/pull/11) | 10,000-row scale run | Manifest drift, near-duplicate contract, missing transcript |
| [#12](https://github.com/sreenathmmenon/cleanroom/pull/12) | Standing pipeline / schedules | Approval gate blocks schedules; recipe identity; flag parsing |
| [#13](https://github.com/sreenathmmenon/cleanroom/pull/13) | Generative-UI claim corrected | Review clean; the PR itself removes an unverifiable claim |
| [#14](https://github.com/sreenathmmenon/cleanroom/pull/14) | Recipes proven end to end + refusal | Fixture executed nothing; misnamed row; capture scope |
| [#15](https://github.com/sreenathmmenon/cleanroom/pull/15) | Roadmap updated to shipped state | Evidence link ahead of its PR; undocumented UI build |
| [#16](https://github.com/sreenathmmenon/cleanroom/pull/16) | UI session-replay bug documented | Review clean; the PR itself retracts a fix that did not work |
| [#17](https://github.com/sreenathmmenon/cleanroom/pull/17) | Demo script act two | Replay had no recipe to match |
| [#18](https://github.com/sreenathmmenon/cleanroom/pull/18) | Scripted refusal replay | Clean |
| [#19](https://github.com/sreenathmmenon/cleanroom/pull/19) | Real data: 5,000 rows of NYC 311 | 5 findings — unexecutable score, local paths, impossible date, count conflict, overstated diagnosis |
| [#21](https://github.com/sreenathmmenon/cleanroom/pull/21) | Real money: 6,000 rows of NYC payroll | Missing check; date conflict; fingerprint; transcript |
| [#22](https://github.com/sreenathmmenon/cleanroom/pull/22) | Scorer provenance binding | Skipped reference values; wrong denominator |

[PR #4](https://github.com/sreenathmmenon/cleanroom/pull/4) is deliberately still
open: the agent opened it, and a human merging it **is** the acceptance step.

## What it does, and where to verify it

Every claim below links to a transcript or a command you can run yourself.

| Capability | Where to see it |
|---|---|
| **It knows when *not* to act** | On [6,000 rows of real NYC payroll](docs/evidence/real-payroll-run.md) — 18/18 checks exact — it **refused to recompute 762 pay mismatches**, the same defect shape it fixes on the sales corpus, because `base_salary` is a rate rather than an expected total and no stored total exists to reconcile against. All five of its questions recommended preserve-and-flag |
| **Works on unfamiliar real data** | [5,000 rows of NYC 311](docs/evidence/real-world-run.md), nothing planted: 8/8 checks exact — and it corrected the verification script three times |
| **Numbers come from code that ran** | Sandbox-executed profiling with measured counts — [flagship run transcript](docs/evidence/flagship-run.md); `npm run demo` reproduces it live |
| **Holds up at scale** | [12/12 planted issue classes detected exactly](docs/evidence/scale-run.md) on 10,000 rows, against a ground-truth manifest |
| **Context stays manageable** | The 10k-row run wrote per-row detail to sandbox files and brought back only the summary table — [scale run](docs/evidence/scale-run.md) |
| **Pauses before anything irreversible** | The gate firing, uncut, in the [3-minute demo](https://youtu.be/AT2VMDGnKN0) — plus per-write `tool.approval_required` events in the [flagship run transcript](docs/evidence/flagship-run.md). Trigger it yourself on the [live instance](https://cleanroom-production.up.railway.app) |
| **State survives a long repair** | One session spans profile → clarify → plan → approve → apply → deliver — see the [flagship run transcript](docs/evidence/flagship-run.md) |
| **Built on TrueForge** | Sandbox-as-tool, `ask_user_questions`, gated MCP writes, [dynamic subagent delegation](docs/evidence/subagent-run.md) on its own thread, persistent sessions, [context management at scale](docs/evidence/scale-run.md) |
| **It learns, reviewably** | The agent authors a cleaning policy as a skill and delivers it as a PR; a human merge is what makes it policy — [run 2: five questions become one](docs/evidence/run2-recipe.md) |
| **Reviewed before merge** | [Every merged PR carries its review thread](#qodo-code-review-evidence). The findings that changed the design: a recipe that could never reach the agent, a template demanding impossible provenance, a scheduled run with nobody to approve it, and a scorer that proved the wrong thing |
| **Delivery you can inspect** | [PR #4](https://github.com/sreenathmmenon/cleanroom/pull/4) — agent-authored, with an 86-line change report, row reconciliation, and verification suite output |

## Limitations

Stated plainly, because a tool you can trust is one whose edges you know.

- **CSV only.** Excel is the obvious next wedge — the profiling and fix catalog
  are format-agnostic; only the reader changes. CSV first is a deliberate scope
  choice, not an accident.
- **Real-world coverage is two datasets deep.** The [NYC 311 run](docs/evidence/real-world-run.md)
  and the [payroll run](docs/evidence/real-payroll-run.md) show the agent handling
  real municipal and financial data nobody prepared for it, but two corpora are a
  demonstration, not a guarantee across domains.
- **Demo corpus is deterministic and small by design** (42 rows), so the same
  findings appear on every run and you can verify each number by hand.
  A [10,000-row run](docs/evidence/scale-run.md) is published alongside it,
  scored against a generated manifest of ground truth.
- **Date inference is evidence-based, not clairvoyant.** A slash date is
  resolved only when some row proves the order — a component greater than 12
  cannot be a month. With no proof, or contradictory proof, the agent asks
  rather than guesses.
- **One clarification round, by design.** The agent asks only about ambiguities
  that would change the fix plan, and asks them together. Questions that do not
  change the output are not asked at all.
- **Schedules depend on the TrueForge build.** `/api/v1/schedules` is documented
  in the TrueForge API but is not served by release 0.1.4, so the standing
  pipeline is scripted and ready rather than demonstrated. The unattended
  *behavior* — apply the recipe, halt on anything outside it — is exercised by
  `npm run demo:recipe -- --auto`.
- **The UI embed shows the shell, not past sessions.** `node scripts/serve-ui.mjs`
  serves a branded, same-origin embed whose landing view works, but opening a
  session from the history list hits a `useSyncExternalStore` loop inside the UI
  SDK's session store. React 18 pinning and StrictMode removal both fail to fix
  it, and the same sessions read fine over the REST API — see `ui/README.md`.
  Every transcript in `docs/evidence/` was captured through the API.
- **Sandbox mode.** Runs captured here used TrueForge's local sandbox; the
  git-backed skill loads by raw URL in that mode, and the condensed methodology
  is embedded in the agent instructions so behavior is identical either way.

## Status & roadmap

- [x] Agent spec, skill methodology, sample corpus, seeding pipeline
- [x] End-to-end vertical slice on live TrueForge (profile → clarify → plan → gate → verify)
- [x] Approval-gated delivery as a pull request ([PR #4](https://github.com/sreenathmmenon/cleanroom/pull/4) — opened by the agent)
- [x] Scripted one-command replay (`npm run demo`)
- [x] Dynamic subagent delegation for category analysis ([transcript](docs/evidence/subagent-run.md))
- [x] Recipes: the agent distills a run into a policy and delivers it as a PR
      ([DISTILL, matching, and the recipe template](docs/recipe-template.md));
      the run-2 and schema-refusal transcripts land with #14
- [x] [10,000-row scale run](docs/evidence/scale-run.md) scored against a ground-truth manifest
- [x] Branded UI embed served same-origin — build it first, then serve:
      `npm --prefix ui ci && npm --prefix ui run build && node scripts/serve-ui.mjs`
      (see `ui/README.md`, including what does not yet work)
- [ ] Diff previews as custom components in the UI
- [ ] Second dataset persona (inventory export)
- [ ] Standing schedules, once the TrueForge build serves `/api/v1/schedules`

## Built with

AI coding assistants were used during development. All code was reviewed and
verified by the author, who can explain every part of it, and every pull request
was reviewed by Qodo before merge.

## License

MIT — see [LICENSE](LICENSE).
