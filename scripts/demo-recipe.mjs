#!/usr/bin/env node
/**
 * Cleanroom recipe replay — the second run, where the agent already knows.
 *
 *   npm run demo:recipe            interactive: gates and questions pause
 *   npm run demo:recipe -- --auto  unattended: gates auto-approved (b-roll)
 *
 * Act two of the demo. The first run (`npm run demo`) ends by distilling a
 * recipe and delivering it as a pull request; once a human merges it, this
 * script runs the same agent against a fresh export with the same schema.
 * What to watch for: the questions that do NOT get asked, and the single
 * pause on the one value the recipe has never seen (`southwest`).
 *
 * Runs against the seeded `cleanroom` agent on a live TrueForge server.
 * Exit code is non-zero if a turn fails or a human denies a gate.
 */
import { createInterface } from "node:readline/promises";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUTO = process.argv.includes("--auto");

if (existsSync(join(root, ".env"))) {
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    if (line.trimStart().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const base = (process.env.TRUEFORGE_URL ?? "http://localhost:8790").replace(/\/$/, "");
const CSV_URL =
  process.env.DEMO_WEEK2_CSV_URL ??
  "https://raw.githubusercontent.com/sreenathmmenon/cleanroom/main/data/samples/sales_export_messy_week2.csv";

const api = async (path, data) => {
  const res = await fetch(`${base}${path}`, {
    method: data ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (s) => console.log(`\x1b[1;36m${s}\x1b[0m`);

async function ask(q) {
  if (AUTO) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`\x1b[1;33m${q} [y/N]\x1b[0m `)).trim().toLowerCase();
  rl.close();
  return a === "y" || a === "yes";
}

// A question in --auto mode is the recipe escalating: something outside its
// policy needs a human. Answering it with a guess would defeat the rule this
// replay exists to demonstrate, so unattended mode stops and reports instead.
function haltOnEscalation(q) {
  console.log(`\n\x1b[1;35m❓ ESCALATION — a human decision is required:\x1b[0m\n${q}`);
  console.log(
    "\nUnattended mode stops here by design: a recipe licenses silence about the\n" +
      "known, never about the new. Re-run without --auto to answer it.",
  );
  process.exit(2);
}

async function answer(q) {
  if (AUTO) haltOnEscalation(q);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = await rl.question(`\x1b[1;35m${q}\x1b[0m\n> `);
  rl.close();
  return a.trim() || "Use your best judgement and state the assumption in the change report.";
}

const assistantTexts = (evs) =>
  evs
    .filter((e) => e.type === "model.message" && (e.thread_id ?? "main") === "main")
    .map((e) => {
      const c = e.content;
      return typeof c === "string" ? c : (c ?? []).map((p) => p.text ?? "").join("\n");
    })
    .filter((t) => t.trim());

// A pending event names only the tool_call_id; the tool itself is described by
// the model.message that requested it (ToolCallRef.source_event_id).
const describeCall = (evs, ref) => {
  const src = evs.find((e) => e.id === ref.source_event_id);
  const call = (src?.tool_calls ?? []).find((c) => c.id === ref.id);
  return {
    name: call?.tool_info?.name ?? call?.function?.name ?? "(tool)",
    args: (() => {
      try {
        return JSON.parse(call?.function?.arguments || "{}");
      } catch {
        return {};
      }
    })(),
  };
};

async function runTurn(sid, input, label, prevTurnId) {
  say(`\n━▓ ${label}`);
  // A resume must chain to the turn that raised the pause, or the runtime
  // cannot match the submitted item to the call awaiting it.
  const body = { input, stream: false };
  if (prevTurnId) body.previous_turn_id = prevTurnId;
  const { data: turn } = await api(`/api/v1/sessions/${sid}/turns`, body);

  for (;;) {
    await sleep(1000);
    const { data: t } = await api(`/api/v1/sessions/${sid}/turns/${turn.id}`);
    if (t.state?.status === "running") continue;

    const evs = (await api(`/api/v1/sessions/${sid}/turns/${turn.id}/events`)).data ?? [];
    for (const txt of assistantTexts(evs)) console.log(`\n${txt}`);

    const pending = evs.filter((e) => e.type === "tool.approval_required" || e.type === "tool.response_required").at(-1);
    if (!pending) return { status: t.state?.status, evs };

    const ref = (pending.tool_calls ?? [])[0];
    if (!ref) return { status: t.state?.status, evs };
    const { name, args } = describeCall(evs, ref);

    // Questions and approvals resume the same way: a single input item, never
    // mixed with a user message.
    if (pending.type === "tool.response_required") {
      const text = await answer(`❓ ${args.question ?? name}${args.options ? `\n   options: ${args.options.join(" | ")}` : ""}`);
      return runTurn(
        sid,
        [{ type: "user.tool_response", thread_id: pending.thread_id, tool_call_id: ref.id, content: text }],
        `answer: ${String(args.question ?? name).slice(0, 50)}`,
        turn.id,
      );
    }

    const ok = await ask(`🛑 APPROVAL GATE — allow ${name}?`);
    if (!ok) {
      console.log("Denied by human. Halting.");
      process.exit(1);
    }
    return runTurn(
      sid,
      [{ type: "user.tool_approval", thread_id: pending.thread_id, tool_call_id: ref.id, approval: { status: "allow" } }],
      `gate: ${String(name).slice(0, 40)}`,
      turn.id,
    );
  }
}

const health = await fetch(`${base}/api/v1/agents`).catch(() => null);
if (!health?.ok) {
  console.error(`TrueForge not reachable at ${base}. Run ./scripts/setup.sh and npm run setup:all first.`);
  process.exit(1);
}

const { data: session } = await api("/api/v1/sessions", { agent: { name: "cleanroom" } });
console.log(`Cleanroom recipe replay — session ${session.id} — ${AUTO ? "AUTO" : "INTERACTIVE"} mode`);
console.log(`Dataset: ${CSV_URL}`);
console.log(`Watch for: no questions about dates, duplicates, or known regions — and one pause on "southwest".\n`);

const request = `A new export arrived for the same data source: ${CSV_URL}

Clean it end-to-end per your workflow. Before profiling, check whether a
cleaning recipe matches this file's schema signature; if one does, announce it
with its provenance and apply its confirmed policies without asking me about
them again. Ask only about what the recipe does not cover. Everything else is
unchanged: measured findings, a labelled plan, my approval before anything
destructive, and verification before you claim success.`;

const { status } = await runTurn(session.id, [{ type: "user.message", content: request }], "RECIPE MATCH → PROFILE → PLAN");
if (status !== "done") {
  console.error(`\nReplay ended in state "${status}".`);
  process.exit(1);
}
say(`\nReplay finished (${status}).`);
