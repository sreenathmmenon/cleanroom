#!/usr/bin/env node
/**
 * Register a merged recipe with TrueForge, so the agent can match it on a
 * later run.
 *
 *   npm run recipe:register -- sales-export
 *   npm run recipe:register -- sales-export --ref main
 *
 * The agent authors a recipe at DISTILL and delivers it as a pull request.
 * Merging that PR is the learning gate. This script is the step after the
 * gate: it points TrueForge at the merged file, as a git-backed skill named
 * `recipe-<slug>`. `npm run seed` then attaches every registered recipe to
 * the agent.
 *
 * Registration is a per-name upsert, so re-running is safe and updates the
 * recipe in place.
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

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const refFlag = args.indexOf("--ref");
const ref = refFlag !== -1 ? args[refFlag + 1] : (process.env.SKILL_REF ?? "main");

if (!slug) {
  console.error("Usage: npm run recipe:register -- <dataset-slug> [--ref <branch|tag|sha>]");
  console.error("The slug is the directory under skills/recipes/, e.g. sales-export.");
  process.exit(1);
}
// TrueForge resource names: lowercase, 2-64 chars, no leading/trailing punctuation.
if (!/^[a-z](?:[a-z0-9._-]{0,55}[a-z0-9])$/.test(slug)) {
  console.error(`Invalid slug "${slug}": use lowercase letters, digits, dot, dash, underscore.`);
  process.exit(1);
}

const base = (process.env.TRUEFORGE_URL ?? "http://localhost:8790").replace(/\/$/, "");
const repo = process.env.RECIPE_REPO_URL ?? "https://github.com/sreenathmmenon/cleanroom";
const name = `recipe-${slug}`;

const manifest = {
  type: "git",
  name,
  url: repo,
  ref,
  path: `skills/recipes/${slug}`,
  description:
    `Standing cleaning policy for ${slug} exports: applies the fixes a human confirmed, ` +
    `and pauses for schema changes, unseen categories, or anything the recipe does not cover.`,
};

const res = await fetch(`${base}/api/v1/settings/skills`, {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ manifest }),
}).catch((err) => {
  console.error(`Cannot reach TrueForge at ${base}: ${err.code ?? err.message}`);
  process.exit(1);
});

if (!res.ok) {
  console.error(`Registering "${name}" failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}

console.log(`Registered skill "${name}" from ${repo} @ ${ref} (skills/recipes/${slug}).`);
console.log("Next: npm run seed   # attaches it to the agent, then the next run can match it");
