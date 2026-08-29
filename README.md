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
7. **Deliver** — `cleaned_<name>` + `change_report.md` written via an MCP filesystem tool that requires approval for writes, then offered for download. Your original is never modified.

## Why TrueForge (and not a script, and not a chatbot)

A script can't ask; a chatbot can't be trusted to execute. The harness is the
difference, and every capability below is load-bearing:

| TrueForge capability | What it does in Cleanroom |
|---|---|
| Sandbox-as-tool | All profiling/fixing code runs isolated via Daytona; the user's file is never at risk |
| Human checkpoints | MCP write/destructive tools require approval — the export itself passes through the gate |
| `ask_user_questions` | One structured round of clarification instead of silent guesses |
| Generative UI | Findings tables and before/after previews render rich, not as markdown soup |
| Dynamic subagents | Column-type inference and category canonicalization delegate to focused subagents, keeping the root context clean |
| Skills (git-backed) | The `data-cleaning` methodology lives in `skills/data-cleaning/SKILL.md` in this repo — versioned, reviewable, reusable |
| Persistent sessions | A dataset's cleaning history survives across turns — refine instead of restart |
| Context management | Large profiling outputs offload to the sandbox instead of flooding context |

## Quickstart

Prereqs: Node 22+, a model API key, a free [Daytona](https://daytona.io) key.

```bash
git clone https://github.com/sreenathmmenon/cleanroom.git
cd cleanroom

./scripts/setup.sh          # launches TrueForge local mode on :3000
# In another terminal — the scripted path (secrets stay in local .env):
cp .env.example .env        # fill in MODEL_API_KEY + DAYTONA_API_KEY
npm run setup:all           # configures providers + skill, then seeds the agent
#   Settings → Connectors  add MCP "filesystem" server scoped to a workspace dir
```

Open the TrueForge chat UI → Agents Library → **Cleanroom** → Try, and attach
`data/samples/sales_export_messy.csv` — a realistic 42-row export planted with
exact duplicates from a double import, a near-duplicate, three date formats,
currency strings, region variants, nulls, a negative quantity, and wrong totals.

## Sample dataset

`data/samples/sales_export_messy.csv` is the demo corpus: deterministic,
self-explaining issues whose fixes make a compelling 3-minute walkthrough
(see `docs/demo-script.md`).

## Safety model

- The original file is read-only by construction — all work happens on a sandbox copy.
- Destructive steps (row drops, overwrites, exports) are individually labeled and gated.
- The verification suite must pass before success is claimed; a failed assertion halts the run.
- Nothing leaves the sandbox except files the user explicitly approved.

## Architecture

See `docs/architecture.md`. In one line: TrueForge agent ← instructions +
skill from this repo; sandbox for compute; filesystem MCP (approval-gated) for
export; chat UI (custom-themed embed coming) for interaction.

## Qodo Code Review Evidence

Every PR in this repo is reviewed by [Qodo](https://www.qodo.ai) before merge;
direct pushes to `main` carry no feature work.

- **PR #1 — initial scaffold** (agent manifest, skill, samples, scripts, docs):
  [#1](https://github.com/sreenathmmenon/cleanroom/pull/1). Summary of Qodo
  findings and our responses will be added here as reviews land.

## Status & roadmap

- [x] Agent spec, skill methodology, sample corpus, seeding pipeline
- [ ] End-to-end vertical slice on live TrueForge (profile → gate → verify)
- [ ] Custom-themed embeddable UI with diff previews
- [ ] Second dataset persona (inventory export)

## License

MIT — see [LICENSE](LICENSE).
