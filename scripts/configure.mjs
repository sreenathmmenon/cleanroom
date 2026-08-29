#!/usr/bin/env node
/**
 * Configure a running TrueForge server from local .env values:
 *   1. Model provider  (catalog preset + MODEL_API_KEY)
 *   2. Sandbox provider (Daytona + DAYTONA_API_KEY)
 *   3. data-cleaning git skill (this repo, SKILL_REF)
 *
 * Secrets are read from .env (gitignored), sent over localhost to TrueForge's
 * settings API, and never logged. Redacted values keep stored keys on re-run,
 * so this script is idempotent and safe to run repeatedly.
 *
 * Env: TRUEFORGE_URL, MODEL_PROVIDER, MODEL_API_KEY, DAYTONA_API_KEY, SKILL_REF
 * No external dependencies — Node 22+ (built-in fetch).
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Minimal .env loader (no deps): KEY=VALUE lines, # comments, optional quotes.
const env = { ...process.env };
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trimStart().startsWith("#")) {
      env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const base = (env.TRUEFORGE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const redact = (s) => (s ? `${String(s).slice(0, 4)}…${String(s).slice(-2)} (${String(s).length} chars)` : "(empty)");
const api = (path, init) =>
  fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });

const up = await api("/api/v1/catalogs/model-providers").catch(() => null);
if (!up || !up.ok) {
  console.error(`Cannot reach TrueForge at ${base}. Start it first: ./scripts/setup.sh`);
  process.exit(1);
}

// 1. Model provider: copy the catalog preset, inject the key.
const { model_providers: providerCatalog = [] } = await up.json();
const providerName = env.MODEL_PROVIDER;
const preset = providerCatalog.find(
  (p) => p.name === providerName || p.manifest?.name === providerName,
);
if (!providerName || !env.MODEL_API_KEY) {
  console.log("MODEL_PROVIDER/MODEL_API_KEY not set — skipping model setup.");
  console.log("Available presets:", providerCatalog.map((p) => p.name ?? p.manifest?.name).join(", "));
} else if (!preset) {
  console.error(`No catalog preset named "${providerName}". Available: ${providerCatalog.map((p) => p.name).join(", ")}`);
  process.exit(1);
} else {
  const manifest = structuredClone(preset.manifest ?? preset);
  manifest.auth = { api_key: env.MODEL_API_KEY };
  const r = await api("/api/v1/settings/model-providers", {
    method: "PUT",
    body: JSON.stringify({ manifest }),
  });
  if (!r.ok) {
    console.error(`Model provider setup failed (${r.status}): ${await r.text()}`);
    process.exit(1);
  }
  console.log(`Model provider "${providerName}" configured (key ${redact(env.MODEL_API_KEY)}).`);
}

// 2. Sandbox provider: Daytona preset + key.
if (env.DAYTONA_API_KEY) {
  const sb = await api("/api/v1/catalogs/sandbox-providers");
  const { sandbox_providers: sbCatalog = [] } = sb.ok ? await sb.json() : {};
  const sbPreset = sbCatalog[0]; // Daytona is the shipped provider
  const manifest = sbPreset?.manifest
    ? { ...structuredClone(sbPreset.manifest), auth: { api_key: env.DAYTONA_API_KEY } }
    : { type: "daytona", auth: { api_key: env.DAYTONA_API_KEY } };
  const r = await api("/api/v1/settings/sandbox-providers", {
    method: "PUT",
    body: JSON.stringify({ manifest }),
  });
  if (!r.ok) {
    console.error(`Sandbox provider setup failed (${r.status}): ${await r.text()}`);
    process.exit(1);
  }
  console.log(`Sandbox provider "${manifest.type}" configured (key ${redact(env.DAYTONA_API_KEY)}).`);
} else {
  console.log("DAYTONA_API_KEY not set — skipping sandbox setup.");
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
  if (!r.ok) {
    console.error(`Skill setup failed (${r.status}): ${await r.text()}`);
    process.exit(1);
  }
  console.log(`Skill "data-cleaning" registered from repo @ ${env.SKILL_REF}.`);
}

console.log("\nNext: npm run seed   # then open the chat UI and try Cleanroom");
