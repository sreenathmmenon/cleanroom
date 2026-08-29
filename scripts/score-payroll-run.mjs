#!/usr/bin/env node
/**
 * Score the NYC payroll profiling run against the independent reference.
 *
 *   npm run score:payroll
 *
 * docs/evidence/real-payroll-run.md claims the agent matched an independently
 * measured reference on nine checks, and matched six more the reference never
 * thought to measure. Both claims need a command behind them, so this recomputes
 * every value from the corpus and compares it with the figure the agent
 * reported, transcribed here verbatim from that run.
 *
 * Exit code is non-zero if any comparison fails. No dependencies — Node 22+.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = join(root, "data/samples/nyc_payroll_messy.csv");
const refPath = join(root, "data/samples/nyc_payroll_reference.json");

// Matching counts is not the same as scoring the documented corpus: a different
// file preserving the same aggregates would pass. Bind the run to its bytes.
const AGENT_CORPUS_SHA256 =
  "fa81f5f60b2201097b2ab5e1fc785bb22602c96c2bce8a3b09390d8cc231932a";

// What the agent reported, from docs/evidence/real-payroll-run.md
// (session 01m17xm1abdhtdw2zqf2xxwe41).
const AGENT = {
  rows: 6000,
  columns: 17,
  exact_duplicate_rows: 0,
  ot_paid_with_zero_ot_hours: 1068,
  ot_hours_with_zero_ot_paid: 6,
  negative_regular_gross_paid: 114,
  negative_total_other_pay: 123,
  negative_regular_hours: 36,
  negative_ot_hours: 12,
  agency_name_variant_rows: 293,
  empty_work_location_borough: 657,
  // Reported by the agent; the reference had not thought to measure these.
  mid_init_empty: 6000,
  regular_pay_with_zero_regular_hours: 3014,
  payroll_number_missing: 1893,
  borough_variant_rows: 19,
  rows_with_any_negative: 223,
  repeated_employee_year_rows: 228,
  repeated_employee_year_groups: 112,
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c.charCodeAt(0) !== 13) field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const csvBytes = readFileSync(csvPath);
const actualSha = createHash("sha256").update(csvBytes).digest("hex");
if (actualSha !== AGENT_CORPUS_SHA256) {
  console.error("Corpus fingerprint does not match the evidenced run.");
  console.error(`  expected ${AGENT_CORPUS_SHA256}`);
  console.error(`  actual   ${actualSha}`);
  console.error("The scored numbers describe a different file than the transcript does.");
  process.exit(1);
}

// The reference JSON is the independently measured record; scoring must agree
// with it as well as with the agent, or one of the three has drifted.
const reference = JSON.parse(readFileSync(refPath, "utf8"));
if (reference.sha256 !== AGENT_CORPUS_SHA256) {
  console.error(`Reference JSON records a different corpus (${reference.sha256}).`);
  process.exit(1);
}

const raw = parseCsv(csvBytes.toString("utf8"));
const header = raw[0].map((h) => h.replace(/^"|"$/g, ""));
const data = raw.slice(1).filter((r) => r.length === header.length);
const col = (r, name) => r[header.indexOf(name)] ?? "";
const num = (r, name) => {
  const v = parseFloat(col(r, name));
  return Number.isFinite(v) ? v : null;
};
const empty = (r, name) => !col(r, name).trim();

// Rows that differ only by case in a categorical column are canonicalization
// candidates; count the rows that would actually change.
const variantRows = (name) => {
  const counts = new Map();
  for (const r of data) {
    const v = col(r, name).trim();
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const groups = new Map();
  for (const [v, n] of counts) {
    const k = v.toUpperCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push([v, n]);
  }
  let total = 0;
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const dominant = members.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    total += members.filter(([v]) => v !== dominant).reduce((s, [, n]) => s + n, 0);
  }
  return total;
};

const seen = new Map();
for (const r of data) {
  const k = r.join(" ");
  seen.set(k, (seen.get(k) ?? 0) + 1);
}

const NEG_FIELDS = [
  "regular_gross_paid",
  "total_other_pay",
  "regular_hours",
  "ot_hours",
  "total_ot_paid",
];

// The candidate key: one employee, one fiscal year, one agency. Groups with more
// than one row are repeats — which the agent found are legitimate simultaneous
// titles or pay bases within an agency, not duplicates. (Employee-plus-year
// alone is far looser: 1,851 rows in 913 groups, since the same person may
// appear under several agencies.)
const keyGroups = new Map();
for (const r of data) {
  const k = [col(r, "fiscal_year"), col(r, "last_name"), col(r, "first_name"), col(r, "agency_name")].join("|");
  keyGroups.set(k, (keyGroups.get(k) ?? 0) + 1);
}
const repeated = [...keyGroups.values()].filter((n) => n > 1);

const REFERENCE = {
  rows: data.length,
  columns: header.length,
  exact_duplicate_rows: [...seen.values()].reduce((s, c) => s + (c - 1), 0),
  ot_paid_with_zero_ot_hours: data.filter(
    (r) => (num(r, "total_ot_paid") ?? 0) > 0 && (num(r, "ot_hours") ?? 0) === 0,
  ).length,
  ot_hours_with_zero_ot_paid: data.filter(
    (r) => (num(r, "ot_hours") ?? 0) > 0 && (num(r, "total_ot_paid") ?? 0) === 0,
  ).length,
  negative_regular_gross_paid: data.filter((r) => (num(r, "regular_gross_paid") ?? 0) < 0).length,
  negative_total_other_pay: data.filter((r) => (num(r, "total_other_pay") ?? 0) < 0).length,
  negative_regular_hours: data.filter((r) => (num(r, "regular_hours") ?? 0) < 0).length,
  negative_ot_hours: data.filter((r) => (num(r, "ot_hours") ?? 0) < 0).length,
  agency_name_variant_rows: variantRows("agency_name"),
  empty_work_location_borough: data.filter((r) => empty(r, "work_location_borough")).length,
  mid_init_empty: data.filter((r) => empty(r, "mid_init")).length,
  regular_pay_with_zero_regular_hours: data.filter(
    (r) => (num(r, "regular_gross_paid") ?? 0) > 0 && (num(r, "regular_hours") ?? 0) === 0,
  ).length,
  payroll_number_missing: data.filter((r) => empty(r, "payroll_number")).length,
  borough_variant_rows: variantRows("work_location_borough"),
  rows_with_any_negative: data.filter((r) => NEG_FIELDS.some((f) => (num(r, f) ?? 0) < 0)).length,
  repeated_employee_year_rows: repeated.reduce((s, n) => s + n, 0),
  repeated_employee_year_groups: repeated.length,
};

// Cross-check the reference JSON. Same-named keys compare directly; values it
// stores under a different shape are mapped explicitly, so nothing is skipped
// merely because the names differ.
const REF_JSON = reference.measured ?? {};
const refExpected = new Map();
for (const k of Object.keys(REFERENCE)) {
  if (k in REF_JSON) refExpected.set(k, REF_JSON[k]);
}
refExpected.set("rows", reference.shape?.rows);
refExpected.set("columns", reference.shape?.columns);

let refFailed = 0;
for (const [k, expected] of refExpected) {
  if (expected === undefined) {
    console.error(`Reference JSON records no value for ${k}`);
    refFailed++;
  } else if (expected !== REFERENCE[k]) {
    console.error(`Reference JSON disagrees on ${k}: ${expected} vs recomputed ${REFERENCE[k]}`);
    refFailed++;
  }
}

let failed = 0;
console.log(`corpus SHA-256 ${actualSha.slice(0, 16)}… matches the evidenced run\n`);
console.log(`${"check".padEnd(40)}${"reference".padStart(11)}${"agent".padStart(8)}`);
console.log("-".repeat(66));
for (const [k, agent] of Object.entries(AGENT)) {
  const ref = REFERENCE[k];
  const ok = ref === agent;
  if (!ok) failed++;
  console.log(
    `${k.padEnd(40)}${String(ref).padStart(11)}${String(agent).padStart(8)}  ${ok ? "exact" : "DIFFERS"}`,
  );
}
console.log("-".repeat(66));

const agentTotal = Object.keys(AGENT).length;
const refTotal = refExpected.size;
if (failed || refFailed) {
  if (failed) console.error(`\n${failed} of ${agentTotal} agent comparisons failed.`);
  if (refFailed) console.error(`${refFailed} of ${refTotal} reference cross-checks failed.`);
  process.exit(1);
}
console.log(
  `\n${agentTotal} of ${agentTotal} agent comparisons exact; ` +
    `${refTotal} of ${refTotal} reference cross-checks agree.`,
);
