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
messy.csv ──▶ PROFILE ──▶ CLARIFY ──▶ PLAN ──▶ 🛑 APPROVAL GATE ──▶ APPLY ──▶ VERIFY ──▶ cleaned.csv + change_report.md
                (sandbox)  (ask-user)  (previews)   (human decides)    (sandbox)  (assertions)      (download)
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

<a id="scale"></a>

## Does it hold up at size?

The 42-row corpus is small so you can check every number by hand. That is also
its limit, so there is a second corpus of **10,000 rows** — generated with a
fixed seed by `scripts/make_large_corpus.py`, which counts every issue *as it
plants it* and writes the counts to `data/samples/large_manifest.json`. The
profiling run is then scored against ground truth rather than believed.

**Ten of ten planted issue classes were detected exactly** — 41 duplicate rows,
2,002 slash dates, 1,009 text dates, 68 broken totals, 68 missing customers, 23
negative quantities, 27 `USD` suffixes, and the nulls in each financial column —
with no false positives, in about three minutes. The two category classes
reconcile too: of 4,114 planted region variants the agent canonicalized 3,309
and **refused to decide 805**, flagging `New York` as possibly the city or the
state and asking instead.

Profiling is size-independent because it is pandas in a sandbox, and the run
demonstrates the harness's context management doing real work: the per-row
detail went to sandbox files and only the summary table entered the
conversation. Full numbers and transcript in
[`docs/evidence/scale-run.md`](docs/evidence/scale-run.md).

```bash
python3 scripts/make_large_corpus.py   # regenerates the identical corpus + manifest
```

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
| Harness visibly does real work | Sandbox-executed profiling with measured counts — [flagship run transcript](docs/evidence/flagship-run.md); `npm run demo` reproduces it live. At 10,000 rows, [10/10 planted issue classes detected exactly](docs/evidence/scale-run.md) against a ground-truth manifest |
| Context management | The 10k-row run wrote per-row detail to sandbox files and brought back only the summary table — [scale run](docs/evidence/scale-run.md) |
| Control & safety (pause before irreversible) | Plan gate + per-write `tool.approval_required` events captured in the demo video, uncut |
| Persistent sessions | A full repair spans many turns on one session — profile, clarify, plan, approve, apply, deliver — as the [flagship run transcript](docs/evidence/flagship-run.md) shows. Browser reattachment mid-run is a planned demo shot (`docs/demo-script.md`), not yet a captured artifact |
| Use of TrueForge | Sandbox-as-tool, ask-user-questions (5-question round), gated MCP writes, [dynamic subagent delegation](docs/evidence/subagent-run.md) (its own thread, `thread.created`/`thread.done`), persistent sessions, generative UI tables |
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
  A [10,000-row run](docs/evidence/scale-run.md) is published alongside it,
  scored against a generated manifest of ground truth.
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
