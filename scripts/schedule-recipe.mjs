#!/usr/bin/env node
/**
 * Put a recipe on a schedule: the standing pipeline.
 *
 *   npm run recipe:schedule -- --url <csv-url> --cron "0 9 * * 1" --tz Asia/Kolkata
 *   npm run recipe:schedule -- --list
 *
 * Once a recipe has been reviewed and merged, the cleaning can run without a
 * person present. The rules do not relax: recipe policies auto-apply, and
 * anything outside the recipe — a schema change, an unseen category, a failed
 * assertion — stops the run and reports. Unattended is not permission to guess.
 *
 * Requires a TrueForge build that serves /api/v1/schedules. Where the endpoint
 * is absent this script says so plainly rather than pretending; run
 * `npm run demo:recipe` to exercise the same behavior interactively.
 *
 * No external dependencies — Node 22+.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(root, ".env"))) {
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    if (line.trimStart().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const base = (process.env.TRUEFORGE_URL ?? "http://localhost:8790").replace(/\/$/, "");

const api = (path, init) =>
  fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });

const explainMissing = (res) => {
  console.error(
    `This TrueForge build does not serve ${res.url.replace(base, "")} (HTTP ${res.status}).\n` +
      `Schedules are part of the TrueForge API but are not available in every build.\n` +
      `The agent's scheduled-run rules are defined in agent/instructions.md and can be\n` +
      `exercised interactively with: npm run demo:recipe`,
  );
  process.exit(3);
};

if (argv.includes("--list")) {
  const res = await api("/api/v1/schedules?agent_name=cleanroom").catch((e) => {
    console.error(`Cannot reach TrueForge at ${base}: ${e.code ?? e.message}`);
    process.exit(1);
  });
  if (res.status === 404) explainMissing(res);
  if (!res.ok) {
    console.error(`List failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const { data = [] } = await res.json();
  if (!data.length) console.log("No schedules for agent 'cleanroom'.");
  for (const s of data) {
    console.log(`${s.name}  ${s.manifest?.cron}  ${s.manifest?.timezone ?? "UTC"}  [${s.manifest?.status ?? "active"}]  id=${s.id}`);
  }
  process.exit(0);
}

const url = flag("url");
const cron = flag("cron", "0 9 * * 1");
const timezone = flag("tz", "UTC");
const name = flag("name", "weekly-export-clean");
const status = argv.includes("--active") ? "active" : "paused";

if (!url) {
  console.error('Usage: npm run recipe:schedule -- --url <csv-url> [--cron "0 9 * * 1"] [--tz Asia/Kolkata] [--name <n>] [--active]');
  console.error("       npm run recipe:schedule -- --list");
  console.error("\nCron is the standard 5-field form, evaluated in the given IANA timezone.");
  console.error("Schedules are created paused unless --active is passed, so a run never");
  console.error("starts before you have looked at it.");
  process.exit(1);
}

const body = {
  agent_name: "cleanroom",
  name,
  manifest: {
    task:
      `A new export is available: ${url}\n\n` +
      `Clean it end-to-end per your workflow. Check for a recipe matching this ` +
      `file's schema signature first, and apply its confirmed policies without ` +
      `asking again. Nobody is watching this run: if anything falls outside the ` +
      `recipe — a schema change, an unseen category, a profile outside recorded ` +
      `bounds, or a failed assertion — stop and report it rather than deciding. ` +
      `Do not deliver anything that has not passed verification.`,
    cron,
    timezone,
    status,
  },
};

const res = await api("/api/v1/schedules", { method: "POST", body: JSON.stringify(body) }).catch((e) => {
  console.error(`Cannot reach TrueForge at ${base}: ${e.code ?? e.message}`);
  process.exit(1);
});
if (res.status === 404) explainMissing(res);
if (!res.ok) {
  console.error(`Create failed (${res.status}): ${(await res.text()).slice(0, 400)}`);
  process.exit(1);
}
const { data } = await res.json();
console.log(`Created schedule "${data.name}" (${cron}, ${timezone}, ${status}) — id ${data.id}`);
console.log("Scheduled runs follow the same rules: recipe policies auto-apply, anything else pauses.");
