# Recipe template

A recipe is a standing cleaning policy for one data source, authored by the
agent at the end of a successful run and delivered as a pull request. Merging
that pull request is what turns it into policy — the agent cannot promote its
own learning.

Everything in `{braces}` is computed in the sandbox or confirmed by the user on
the run that created the recipe. Nothing may be invented: every policy line
carries provenance, and every threshold is a measured number from that run.

---

```markdown
---
name: recipe-{dataset-slug}
description: Standing cleaning policy for {dataset human name} exports
  (schema {short-signature}). Auto-applies confirmed fixes; pauses for
  anything outside this recipe. Learned {date} from run {run-id}, merged
  via branch cleanroom/recipe-{dataset-slug}.
---

# Cleaning recipe: {dataset human name}

## 1. Recognition
- Schema signature: {sha256}
- Derivation (must be reproducible): for each column in file order, trim and
  lowercase the name and collapse internal whitespace; pair it with a logical
  dtype from `integer | decimal | date | boolean | string`; join as `name:dtype`,
  join pairs with a newline, encode UTF-8, SHA-256.
- Columns ({count}): {ordered name:dtype list}
- If the incoming file does NOT match this signature exactly: STOP. Do
  not apply this recipe. Report what changed and run a first-run CLARIFY
  for the differences.

## 2. Confirmed policies (apply without asking)
Each line: policy, then provenance.
- Dates: {policy}. Confirmed by user, run {run-id}; evidence: {n} rows
  with day component > 12.
- Duplicates: {policy}. Confirmed by user, run {run-id}.
- Category canon map ({column}): {value -> canonical, ...}. Confirmed by
  user, run {run-id}.
- Nulls: {per-column policy}. Confirmed by user, run {run-id}.
- Computed totals: {policy}. Confirmed by user, run {run-id}.

## 3. Fix pipeline (exact order)
1. {step} — safe/destructive — max rows affected: {measured n}
2. {step} — ...
(This is the order that passed verification on the creating run. Do not
reorder.)

## 4. Verification assertions (all must pass)
- Row reconciliation: input rows − dropped ({n}) = output rows.
- Idempotence: running the pipeline on its own output changes 0 rows.
- {dtype assertions per column}
- {null-ceiling assertions per column}
- {domain assertions}
On any failure: STOP, report, do not deliver.

## 5. Escalation rules (always pause and ask)
- Schema signature mismatch (see §1).
- Unseen categorical value in {column}: value not in §2 canon map.
- Row count outside {measured baseline ± tolerance %}.
- Null rate in any column above {recorded ceiling %}.
- Any single step affecting more rows than its §3 max by >{tolerance}.
- Any §4 assertion failure.
- Anything this recipe is silent on.

## 6. Open questions (NOT policy — ask if encountered)
- {inferred-but-never-confirmed choices from the creating run, if any}

## 7. Provenance
- Created: {date}, run {run-id}, source file SHA-256 {hash}.
- Delivered on branch `cleanroom/recipe-{dataset-slug}`; review and merge pending.
- Supersedes: {previous recipe version or "none"}.

(Only facts that exist when the file is written belong here. Who merged the
recipe and when are not knowable from inside the pull request that introduces
it — the merge is its own record. Never write a merge date or reviewer name.)
```

## Rules the agent must not break when filling this in

1. **Only confirmed policy.** A rule may appear in §2 only if the user answered
   a clarification question about it or approved a plan step that encoded it.
   Anything the agent inferred but never asked belongs in §6 as an open
   question, never in §2 as a rule.
2. **A signature must be reproducible.** The derivation above is part of the
   recipe, and the logical dtype set is closed on purpose: a column read as
   `int64` on one run and `Int64` on another must still hash the same. Record
   the column list beside the hash so a mismatch is explained as "column X
   changed", not as two unequal hashes.
3. **Numbers, not vibes.** Every threshold in §4 and §5 is a measured value
   from the creating run's profile. "Roughly the usual row count" is not a
   threshold; `40 ± 20%` is.
4. **A recipe licenses silence about the known, never about the new.** If the
   incoming file contains anything the recipe does not describe, the agent
   pauses and asks.
5. **Provenance on every line.** A reader must be able to trace each rule to
   the run and the human decision that produced it.
