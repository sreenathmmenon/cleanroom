# Test fixtures

Small corpora that exist to prove a *refusal*, not a repair.

- `week2_renamed_column.csv` — the week-2 export with `region` renamed to
  `sales_region`. Its schema signature therefore differs from the one recorded
  in `skills/recipes/sales-export/SKILL.md`, and the agent must decline to apply
  that recipe and fall back to first-run behavior. A recipe that fires on the
  wrong schema is worse than no recipe.
