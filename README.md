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

Built for [The Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge)
(WeMakeDevs × TrueFoundry, Aug 24–30, 2026).

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
7. **Deliver** — the agent opens a **pull request** through the GitHub MCP server: a branch `cleanroom/delivery-<id>` carrying `exports/<id>/cleaned_<name>` and `exports/<id>/change_report.md`. Every write is individually approval-gated, and the PR is the paper trail a human reviews and merges — acceptance is your act, not the agent's. The sandbox files are offered for direct download too. Your original is never modified.

## Why TrueForge (and not a script, and not a chatbot)

A script can't ask; a chatbot can't be trusted to execute. The harness is the
difference, and every capability below is load-bearing:

| TrueForge capability | What it does in Cleanroom |
|---|---|
| Sandbox-as-tool | All profiling/fixing code runs isolated via Daytona; the user's file is never at risk |
| Human checkpoints | GitHub MCP `@write`/`@destructive` tools require approval — every commit and the PR itself pass through the gate |
| `ask_user_questions` | One structured round of clarification instead of silent guesses |
| Generative UI | Findings tables and before/after previews render rich, not as markdown soup |
| Dynamic subagents | Category canonicalization is delegated to a focused subagent via `create_sub_agent`; the root agent receives the map, the counts, and any ambiguity flagged — not the analysis — [captured run](docs/evidence/subagent-run.md) |
| Skills (git-backed) | The `data-cleaning` methodology lives in `skills/data-cleaning/SKILL.md` in this repo — versioned, reviewable, reusable |
| Persistent sessions | A dataset's cleaning history survives across turns — refine instead of restart |
| Context management | Large profiling outputs offload to the sandbox instead of flooding context |

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

The same rules hold unattended. A scheduled run applies the recipe and stops on
any escalation; it never guesses because nobody is watching.

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

Every PR in this repo is reviewed by [Qodo](https://www.qodo.ai) before merge;
direct pushes to `main` carry no feature work. Review priorities are codified in
[`.pr-agent.toml`](.pr-agent.toml): secret hygiene, API correctness,
determinism, judge runnability.

| PR | Qodo findings | Our response |
|---|---|---|
| [#1 — scaffold + bring-up](https://github.com/sreenathmmenon/cleanroom/pull/1) | 11 bugs across 4 review passes (env-precedence mismatch, text dates unparseable, ambiguous dates silently guessed, key fragments in logs, success output after failed setup, TDZ ordering, …) | 10 fixed in four follow-up commits on the same PR; 1 security finding (classic-token scope) [dismissed with a written rotation argument](https://github.com/sreenathmmenon/cleanroom/pull/1#issuecomment-5461708004) |
| [#2 — scripted demo](https://github.com/sreenathmmenon/cleanroom/pull/2) | 0 bugs; alternative-approach note (streaming vs polling) | [Kept polling per Qodo's own recommendation](https://github.com/sreenathmmenon/cleanroom/pull/2#issuecomment-5461756405) — dependency-free, explicit turn resumption |
| [#3 — local-skill decoupling](https://github.com/sreenathmmenon/cleanroom/pull/3) | 3 suggestions | [Conditional skill attach implemented](https://github.com/sreenathmmenon/cleanroom/pull/3#issuecomment-5461769466); two deferred with reasons |

The finding that shaped the product most: *"Ambiguous dates are guessed"* →
became the evidence-based inference (a component >12 proves its side), which is
now the demo's signature behavior.

## Where to see each judging criterion

| Criterion | Evidence |
|---|---|
| Harness visibly does real work | Sandbox-executed profiling with measured counts — [flagship run transcript](docs/evidence/flagship-run.md); `npm run demo` reproduces it live |
| Control & safety (pause before irreversible) | Plan gate + per-write `tool.approval_required` events captured in the demo video, uncut |
| Persistent sessions | A full repair spans many turns on one session — profile, clarify, plan, approve, apply, deliver — as the [flagship run transcript](docs/evidence/flagship-run.md) shows. Browser reattachment mid-run is a planned demo shot (`docs/demo-script.md`), not yet a captured artifact |
| Use of TrueForge | Sandbox-as-tool, ask-user-questions (5-question round), gated MCP writes, [dynamic subagent delegation](docs/evidence/subagent-run.md) (its own thread, `thread.created`/`thread.done`), persistent sessions, generative UI tables |
| Recipes / skills | The agent authors a cleaning policy as a skill and delivers it as a PR; a human merge is what makes it policy — [run 2: five questions become one](docs/evidence/run2-recipe.md) |
| Use of Qodo | Table above; every merged PR carries its review thread |
| Technical excellence | [Delivery PR #4](https://github.com/sreenathmmenon/cleanroom/pull/4) — agent-authored, with an 86-line change report, row reconciliation, and verification suite output |
| Presentation | 3-minute demo video (link at submission) following `docs/demo-script.md` |

## Limitations

Stated plainly, because a tool you can trust is one whose edges you know.

- **CSV only.** Excel is the obvious next wedge — the profiling and fix catalog
  are format-agnostic; only the reader changes. CSV first is a deliberate scope
  choice, not an accident.
- **Demo corpus is deterministic and demo-scale by design** (42 rows), so the
  same findings appear on every run and a judge can verify each number by hand.
  Profiling itself is size-independent — it is pandas in a sandbox — but no
  large-file run is published here yet, so treat behavior at scale as untested
  rather than proven.
- **Date inference is evidence-based, not clairvoyant.** A slash date is
  resolved only when some row proves the order — a component greater than 12
  cannot be a month. With no proof, or contradictory proof, the agent asks
  rather than guesses.
- **One clarification round, by design.** The agent asks only about ambiguities
  that would change the fix plan, and asks them together. Questions that do not
  change the output are not asked at all.
- **Sandbox mode.** Runs captured here used TrueForge's local sandbox; the
  git-backed skill loads by raw URL in that mode, and the condensed methodology
  is embedded in the agent instructions so behavior is identical either way.

## Status & roadmap

- [x] Agent spec, skill methodology, sample corpus, seeding pipeline
- [x] End-to-end vertical slice on live TrueForge (profile → clarify → plan → gate → verify)
- [x] Approval-gated delivery as a pull request ([PR #4](https://github.com/sreenathmmenon/cleanroom/pull/4) — opened by the agent)
- [x] Scripted replay for judges (`npm run demo`)
- [ ] Custom-themed embeddable UI with diff previews
- [ ] Second dataset persona (inventory export)

## Built with

AI coding assistants were used during development. All code was reviewed and
verified by the author, who can explain every part of it, and every pull request
was reviewed by Qodo before merge.

## License

MIT — see [LICENSE](LICENSE).
