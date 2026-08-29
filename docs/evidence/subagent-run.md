# Subagent delegation — captured run

Cleanroom's PROFILE phase delegates category canonicalization to a **dynamic
subagent** when more than one low-cardinality column needs it. The root agent
sends the distinct values and their counts, and receives back a proposed
canonical map, the row count each mapping would change, and any variant the
subagent judges genuinely ambiguous. The subagent's working analysis never
enters the root context.

This is a transcript of that happening on the sample corpus.

- Session `01m1795ev04fsa4wpdsg85zfch`, turn `01m1795evtck7ngqs04ef15txd`
- Agent `cleanroom`, `config.dynamic_sub_agents.enabled: true`
- Source: `data/samples/sales_export_messy.csv` (42 rows × 9 columns)

## The harness view: a separate thread

TrueForge runs each subagent as its own thread. Grouping the turn's 18 events
by `thread_id` shows the delegation directly — the root agent's work is on
`main`, and the subagent's is on a thread of its own, bracketed by
`thread.created` / `thread.done`:

| Thread | Events |
|---|---|
| *(turn-level)* | `turn.created`, `sandbox.created`, `turn.done` |
| `main` (root agent) | 6 × `model.message`, 5 × `tool.response`, `tool.response_required` |
| `252f6a1b-26d0-487d-baa8-8babbc3da92f` (subagent) | `thread.created`, `model.message`, `thread.done` |

```
thread.created   252f6a1b-26d0-487d-baa8-8babbc3da92f   17:31:24.232Z
thread.done      252f6a1b-26d0-487d-baa8-8babbc3da92f   17:31:30.539Z
```

## The delegation call

The root agent calls the harness's built-in `create_sub_agent` tool, writing the
subagent's instructions itself and passing only the frequency table — not the
file, not the rest of the profile:

```json
{
  "name": "category-canonicalization",
  "input": "Analyze category canonicalization for a 42-row sales CSV. Return ONLY: (1) a proposed canonical mapping per column, (2) the exact row count each mapping would change, and (3) any genuinely ambiguous variants. Do not inspect files or do other profiling. Distinct values/counts:\nregion: NYC=11, East=7, West=7, New York=6, n-y-c=6, west=4, nyc=1.\nstatus: shipped=21, SHIPPED=9, Shipped=4, pending=4, Pending=3, cancelled=1.\nTreat spelling/case/punctuation variants as candidates, but explicitly flag semantic ambiguity (notably whether New York/NYC should remain distinct from East or be merged). Counts must be computed from the supplied frequencies."
}
```

## What the subagent returned

```
1. Proposed canonical mapping per column
   - region: NYC→NYC; New York→NYC; n-y-c→NYC; nyc→NYC; East→East; West→West; west→West
   - status: shipped→shipped; SHIPPED→shipped; Shipped→shipped;
             pending→pending; Pending→pending; cancelled→cancelled

2. Exact row count each mapping would change
   - region: New York→NYC: 6; n-y-c→NYC: 6; nyc→NYC: 1; west→West: 4.  Total changed: 17
   - status: SHIPPED→shipped: 9; Shipped→shipped: 4; Pending→pending: 3. Total changed: 16

3. Genuinely ambiguous variants
   - "New York"→"NYC" is semantically ambiguous: "New York" may mean New York City
     or New York State.
   - Whether NYC/New York should remain distinct from East or be merged is ambiguous
     because they may represent different geographic levels. Proposed mapping keeps
     NYC and East distinct.
```

## What reached the root context

The root agent announced the delegation and carried forward the map and counts
only — the subagent's reasoning stayed in its own thread:

> Profiling found measurable issues across duplicates, nulls, mixed date/currency
> formats, category variants, computed totals, and one negative quantity. […]
> I'm now delegating the required `region` and `status` canonicalization analysis
> using only their distinct values and counts.

> ## PROFILE results
>
> The working copy remains unchanged. Canonicalization analysis for both
> low-cardinality variant columns was **delegated to a dynamic subagent**, as
> requested.
>
> | Issue | Column | Affected | Samples | Suggested fix |
> |---|---|---:|---|---|
> | Region variants | `region` | 17 | `New York`, `n-y-c`, `nyc`, `west` | Apply approved canonical map; `New York` is ambiguous |
> | Status case variants | `status` | 16 | `SHIPPED`, `Shipped`, `Pending` | Canonicalize case using the delegated map |

The counts the root agent reports (17 and 16) are the subagent's measured
numbers, and the ambiguity the subagent flagged became a clarification question
to the user rather than a silent decision. The turn ended on
`tool.response_required` — the agent asking, not assuming.

## Why delegation is conditional

The instructions delegate only when more than one categorical column needs
canonicalization; with a single column the root agent does the analysis inline.
The result is identical either way, because the user approves the map before it
is applied — delegation is a context-management choice, not a behavioral one.
