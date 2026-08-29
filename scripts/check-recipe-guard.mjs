#!/usr/bin/env node
/**
 * Assert that a recipe only matches the schema it was measured against.
 *
 *   npm run check:recipe-guard
 *
 * The signature check is what stops one data source's confirmed decisions being
 * applied to another, so it needs a test that fails when it breaks — not a
 * fixture that merely exists. This recomputes the signature from the recipe's
 * own documented derivation and asserts three things:
 *
 *   1. the recipe's recorded signature is the one its derivation produces;
 *   2. the week-2 export matches it (the recipe must apply where it should);
 *   3. the renamed-column fixture does NOT match (it must refuse where it must).
 *
 * Exit code is non-zero on any failure. No external dependencies — Node 22+.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// The closed logical dtype set from agent/instructions.md. Column types are a
// property of this data source, declared once here so the test is not inferring
// them differently from the agent.
const DTYPES = {
  order_id: "integer",
  order_date: "date",
  customer: "string",
  region: "string",
  product: "string",
  qty: "integer",
  unit_price: "decimal",
  total: "decimal",
  status: "string",
  sales_region: "string", // the renamed column in the refusal fixture
};

const header = (path) => readFileSync(path, "utf8").split("\n")[0].trim().split(",");

// Trim, lowercase, collapse internal whitespace; pair with the logical dtype;
// join name:dtype with newlines; SHA-256 the UTF-8 bytes.
const signature = (columns) =>
  createHash("sha256")
    .update(columns.map((c) => `${c.trim().toLowerCase().replace(/\s+/g, " ")}:${DTYPES[c.trim()] ?? "string"}`).join("\n"))
    .digest("hex");

const recipe = readFileSync(join(root, "skills/recipes/sales-export/SKILL.md"), "utf8");
const recorded = recipe.match(/Schema signature: `([0-9a-f]{64})`/)?.[1];

const checks = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const source = signature(header(join(root, "data/samples/sales_export_messy.csv")));
check(
  "recipe records the signature its derivation produces",
  recorded === source,
  recorded === source ? `${source.slice(0, 16)}…` : `recorded ${recorded?.slice(0, 16)}… vs computed ${source.slice(0, 16)}…`,
);

const week2 = signature(header(join(root, "data/samples/sales_export_messy_week2.csv")));
check("week-2 export matches the recipe (it must apply)", week2 === recorded);

const renamed = signature(header(join(root, "data/samples/tests/week2_renamed_column.csv")));
check(
  "renamed-column fixture does not match (it must be refused)",
  renamed !== recorded,
  `${renamed.slice(0, 16)}… ≠ ${String(recorded).slice(0, 16)}…`,
);

const failed = checks.filter((c) => !c.pass);
if (failed.length) {
  console.error(`\n${failed.length} of ${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`\n${checks.length} checks passed.`);
