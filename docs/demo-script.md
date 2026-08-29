# Demo video script (~3:00)

Goal: prove the harness does real work and that a human controls the
irreversible moment. Cut tight, 1080p, cursor visible, no dead air.

| Time | Beat | On screen | Voiceover (gist) |
|---|---|---|---|
| 0:00–0:20 | Problem | The messy CSV scrolled in an editor; highlight a broken date, a dupe, "$1,234.50" | "Every team has this file. Three people edited it, nobody trusts it, and scripts clean it blindly." |
| 0:20–0:40 | Meet Cleanroom | Agents Library → Cleanroom → Try; attach the sample | "Cleanroom runs on TrueForge — an agent harness with a sandbox, approvals, and skills." |
| 0:40–1:20 | Real work happens | Sandbox executing the profiling script; findings table renders in the chat | "It profiles the data by running real pandas in a sandbox — 42 rows, 3 date formats, 2 exact duplicates from a double import, 1 near-duplicate, 5 rows with nulls, 2 wrong totals, one impossible negative." |
| 1:20–1:40 | It asks | ask_user_questions panel: date ambiguity + null policy | "Where a script would guess, it asks — one round, structured." |
| 1:40–2:30 | **The gate** | Fix plan with destructive steps labeled; agent stops; approval dialog; zoom in; approve | "It won't drop a single row or write a single file without this moment. This pause is the product." |
| 2:30–2:40 | Session survives | Mid-APPLY: refresh the browser; the same session reattaches and the stream resumes where it was | "This is a persistent session — close the tab, come back, the run is still there." |
| 2:40–2:55 | Verified result | Verification suite green; before/after table; MCP write approval; the delivery PR opens | "Fixes applied to a copy, verified with assertions — row counts reconcile, totals recompute, pipeline is idempotent. Delivery is a pull request a human merges." |
| 2:55–3:00 | Close | change_report.md + cleaned CSV side by side; repo URL | "Cleanroom: drop in messy data, get back data you trust. Repo in the description." |

## Act two (optional, +45s): the agent already knows

If the cut has room, the second run is the strongest thirty seconds in the
project — it shows the questions *not* being asked.

| Time | Beat | On screen | Voiceover (gist) |
|---|---|---|---|
| +0:00 | A week later | `npm run demo:recipe` against `sales_export_messy_week2.csv` | "Next week's export. Same source, same problems." |
|  | *(setup)* | Nothing extra to install: the recipe is in the repo at `skills/recipes/sales-export/SKILL.md`, and the replay hands the agent its URL. On a container sandbox, `npm run recipe:register -- sales-export && npm run seed` attaches it as a skill instead. | |
| +0:10 | Recognition | The agent announcing the recipe and its matching signature | "It recognizes the file by its schema, and it remembers what you decided." |
| +0:20 | Silence | Scroll past the profile: no questions about dates, duplicates, currency, regions | "Last week that cost five questions. This week, none of them." |
| +0:30 | **One pause** | The single question: an unseen `southwest`, plus a row count outside the recipe's recorded bounds | "It stops for exactly one thing — the value it has never seen. A recipe lets it stop asking about the known, never about the new." |

The line worth landing: **the agent's memory is a pull request.** Nothing it
learned became policy until a human merged it.

## Shot checklist

- [ ] Terminal: `./scripts/setup.sh` + `npm run seed` visible for 3s (judges see it's reproducible)
- [ ] Sandbox execution visible (not summarized) — the "real work" proof
- [ ] Approval dialog zoomed — the money shot; no cut during the pause
- [ ] Before/after diff readable at 1080p
- [ ] Browser refresh mid-APPLY, stream resuming on the same session (15s)
- [ ] Act two: the five questions that do not get asked, then the one that does
- [ ] No secrets, no personal data anywhere in frame
