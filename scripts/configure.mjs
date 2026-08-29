#!/usr/bin/env node
/**
 * Configure a running TrueForge server from local .env values:
 *   1. Model provider  (catalog preset + MODEL_API_KEY)
 *   2. Sandbox provider (Daytona + DAYTONA_API_KEY)
 *   3. data-cleaning git skill (this repo, SKILL_REF)
 *
 * Secrets are read from .env (gitignored), sent to TrueForge's settings API,
 * and never logged in full (redacted preview only). Catalog presets are
 * copied wholesale so timeouts/model lists stay upstream defaults.
 *
 * Env: TRUEFORGE_URL, MODEL_PROVIDER, MODEL_API_KEY, DAYTONA_API_KEY, SKILL_REF
 * No external dependencies — Node 22+ (built-in fetch).
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Minimal .env loader (no deps): KEY=VALUE lines, # comments, optional quotes.
// Precedence matches seed-agent.mjs: real process env wins, .env fills gaps.
const env = { ...process.env };
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    if (line.trimStart().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const base = (env.TRUEFORGE_URL ?? "http://localhost:8790").replace(/\/$/, "");
// No key fragments in logs — presence and length only.
const redact = (s) => (s ? `set (${String(s).length} chars)` : "(empty)");
const api = (path, init) =>
  fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
const errors = [];
const softFail = (msg) => {
  errors.push(msg);
  console.error(msg);
};

const health = await api("/api/v1/agents").catch(() => null);
if (!health || !health.ok) {
  fail(`Cannot reach TrueForge at ${base}. Start it first: ./scripts/setup.sh`);
}

// 1. Model provider: copy the catalog preset for MODEL_PROVIDER, inject the key.
const providerName = env.MODEL_PROVIDER;
const catalogRes = await api("/api/v1/catalogs/model-providers");
const { data: providerCatalog = [] } = catalogRes.ok ? await catalogRes.json() : {};
const preset = providerCatalog.find((p) => p.type === providerName);

if (!providerName || !env.MODEL_API_KEY) {
  console.log("MODEL_PROVIDER/MODEL_API_KEY not set — skipping model setup.");
  console.log("Available presets:", providerCatalog.map((p) => p.type).join(", "));
} else if (!preset) {
  softFail(`No catalog preset for "${providerName}". Available: ${providerCatalog.map((p) => p.type).join(", ")}`);
} else {
  const { logo: _drop, ...manifest } = structuredClone(preset);
  manifest.auth = { api_key: env.MODEL_API_KEY };
  const r = await api("/api/v1/settings/model-providers", {
    method: "PUT",
    body: JSON.stringify({ manifest }),
  });
  if (!r.ok) softFail(`Model provider setup failed (${r.status}): ${await r.text()}`);
  else {
    console.log(`Model provider "${preset.type}" configured (key ${redact(env.MODEL_API_KEY)}).`);
    console.log("Models available:", preset.models.map((m) => m.name).join(", "));
  }
}

// 2. Sandbox provider: Daytona catalog preset + key.
if (env.DAYTONA_API_KEY) {
  const sb = await api("/api/v1/catalogs/sandbox-providers");
  const { data: sbCatalog = [] } = sb.ok ? await sb.json() : [];
  const sbPreset = sbCatalog[0]; // Daytona is the shipped provider
  const manifest = sbPreset
    ? { ...structuredClone(sbPreset), auth: { api_key: env.DAYTONA_API_KEY } }
    : { type: "daytona", auth: { api_key: env.DAYTONA_API_KEY } };
  const r = await api("/api/v1/settings/sandbox-providers", {
    method: "PUT",
    body: JSON.stringify({ manifest }),
  });
  if (!r.ok) softFail(`Sandbox provider setup failed (${r.status}): ${await r.text()}`);
  else console.log(`Sandbox provider "${manifest.type}" configured (key ${redact(env.DAYTONA_API_KEY)}).`);
} else {
  console.log("DAYTONA_API_KEY not set — skipping sandbox setup (local fallback will be used).");
}

// 3. Git skill: data-cleaning from this repo.
if (env.SKILL_REF) {
  const manifest = {
    name: "data-cleaning",
    description: "Profiling, fixing, and verifying messy tabular data with pandas in a sandbox.",
    type: "git",
    url: "https://github.com/sreenathmmenon/cleanroom",
    ref: env.SKILL_REF,
    path: "skills/data-cleaning",
  };
  const r = await api("/api/v1/settings/skills", {
    method: "PUT",
    body: JSON.stringify({ manifest }),
  });
  if (!r.ok) softFail(`Skill setup failed (${r.status}): ${await r.text()}`);
  else console.log(`Skill "data-cleaning" registered from repo @ ${env.SKILL_REF}.`);
}

// 4. GitHub MCP server (delivery gate): classic PAT with repo scope.
if (env.GITHUB_TOKEN) {
  const manifest = {
    name: "github",
    type: "remote",
    url: "https://api.githubcopilot.com/mcp/",
    description: "Work with issues, pull requests, repository files, and CI status.",
    auth: { type: "header", headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}` } },
  };
  const r = await api("/api/v1/settings/mcp-servers", {
    method: "PUT",
    body: JSON.stringify({ manifest }),
  });
  if (!r.ok) softFail(`GitHub MCP setup failed (${r.status}): ${await r.text()}`);
  else console.log('MCP server "github" configured (delivery gate ready).');
} else {
  console.log("GITHUB_TOKEN not set — skipping GitHub MCP (delivery gate unavailable).");
}

if (errors.length) {
  console.error(`\n${errors.length} step(s) failed — fix the issues above and re-run.`);
  process.exit(1);
}
console.log("\nNext: npm run seed   # then open the chat UI and try Cleanroom");
