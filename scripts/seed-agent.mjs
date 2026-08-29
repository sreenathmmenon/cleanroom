#!/usr/bin/env node
/**
 * Seed (or update) the Cleanroom agent on a running TrueForge server.
 *
 * Reads agent/cleanroom.agent.json, injects the system prompt from
 * agent/instructions.md, then creates or replaces the agent via the API.
 *
 * Env:
 *   TRUEFORGE_URL  base URL of the TrueForge server (default http://localhost:3000)
 *   MODEL_FQN      override model, e.g. "openai/gpt-5.2" (default from manifest)
 *
 * No external dependencies — Node 22+ (built-in fetch).
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Minimal .env loader (no deps): KEY=VALUE lines, # comments, optional quotes.
if (existsSync(join(root, ".env"))) {
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    if (line.trimStart().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
const base = (process.env.TRUEFORGE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const model = process.env.MODEL_FQN;

const spec = JSON.parse(readFileSync(join(root, "agent", "cleanroom.agent.json"), "utf8"));
spec.manifest.instructions = readFileSync(join(root, "agent", "instructions.md"), "utf8");
if (model) spec.manifest.model = { name: model };

// Tolerate unconfigured connectors so a clean clone seeds successfully:
// drop manifest references the server doesn't know (e.g. no GITHUB_TOKEN —
// the delivery gate attaches once `npm run configure` registers it).
const connectors = await api("/api/v1/mcp-servers").catch(() => null);
if (connectors && connectors.ok) {
  const names = new Set(((await connectors.json()).data ?? []).map((m) => m.name));
  const wanted = spec.manifest.mcp_servers ?? [];
  const missing = wanted.filter((m) => !names.has(m.name));
  if (missing.length) {
    console.warn(
      `Warning: dropping unconfigured MCP server(s) from the agent: ${missing.map((m) => m.name).join(", ")}.` +
        ` Run \`npm run configure\` (needs GITHUB_TOKEN) to enable the delivery gate.`,
    );
    spec.manifest.mcp_servers = wanted.filter((m) => names.has(m.name));
  }
}

const api = (path, init) =>
  fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });

const res = await api("/api/v1/agents", { method: "GET" });
if (!res.ok) {
  console.error(`Cannot reach TrueForge at ${base} (${res.status}). Is it running?`);
  process.exit(1);
}
const { data: agents = [] } = await res.json();
const existing = agents.find((a) => a.name === spec.name);

const outcome = existing
  ? await api(`/api/v1/agents/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: spec.name, manifest: spec.manifest }),
    })
  : await api("/api/v1/agents", {
      method: "POST",
      body: JSON.stringify(spec),
    });

if (!outcome.ok) {
  console.error(`Seed failed (${outcome.status}): ${await outcome.text()}`);
  process.exit(1);
}
const saved = (await outcome.json()).data ?? {};
console.log(
  existing
    ? `Updated agent "${spec.name}" (id ${saved.id ?? existing.id}) at ${base}`
    : `Created agent "${spec.name}" (id ${saved.id}) at ${base}`,
);
console.log("Model:", spec.manifest.model.name);
console.log("Next: open the TrueForge chat UI, find Cleanroom in the Agents Library, and Try it.");
