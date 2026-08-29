#!/usr/bin/env node
/**
 * Cleanroom scripted demo — replay the full repair cycle in your terminal.
 *
 *   npm run demo            interactive: approval gates pause for y/n
 *   npm run demo -- --auto  unattended: gates auto-approved (CI/b-roll)
 *
 * Runs against the seeded `cleanroom` agent on a live TrueForge server
 * (see README quickstart). Prints the assistant's reports as they land,
 * and stops at every approval-required tool call — the delivery gate —
 * until a human decides. Exit code is non-zero if any turn fails.
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
const CSV_URL = `${process.env.DEMO_CSV_URL ?? "https://raw.githubusercontent.com/sreenathmmenon/cleanroom/main/data/samples/sales_export_messy.csv"}`;

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

const assistantTexts = (evs) =>
  evs
    .filter((e) => e.type === "model.message")
    .map((e) => {
      const c = e.content;
      return typeof c === "string" ? c : c.map((p) => p.text ?? "").join("\n");
    })
    .filter((t) => t.trim());

async function runTurn(sid, input, label, prevTurnId) {
  say(`\n━▓ ${label}`);
  const body = { input, stream: false };
  if (prevTurnId) body.previous_turn_id = prevTurnId;
  const { data: turn } = await api(`/api/v1/sessions/${sid}/turns`, body);
  const tid = turn.id;

  for (;;) {
    await sleep(1000);
    const { data: t } = await api(`/api/v1/sessions/${sid}/turns/${tid}`);
    const status = t.state?.status;
    if (status === "running") continue;

    const evs = (await api(`/api/v1/sessions/${sid}/turns/${tid}/events`)).data ?? [];
    for (const txt of assistantTexts(evs)) console.log(`\n${txt}`);

    const pending = evs.filter((e) => e.type === "tool.approval_required").at(-1);
    if (pending && status !== "done") {
      const tool = pending.tool_name ?? pending.tool_call_id ?? "(tool)";
      const ok = await ask(`🛑 APPROVAL GATE — allow ${tool}?`);
      if (!ok) {
        console.log("Denied by human. Halting demo.");
        process.exit(1);
      }
      return runTurn(
        sid,
        [{
          type: "user.tool_approval",
          thread_id: pending.thread_id,
          tool_call_id: pending.tool_call_id,
          approval: { status: "allow" },
        }],
        `gate: ${String(tool).slice(0, 40)}`,
        tid,
      );
    }
    return { tid, status, evs };
  }
}

const health = await fetch(`${base}/api/v1/agents`).catch(() => null);
if (!health?.ok) {
  console.error(`TrueForge not reachable at ${base}. Run ./scripts/setup.sh and npm run setup:all first.`);
  process.exit(1);
}

const { data: session } = await api("/api/v1/sessions", { agent: { name: "cleanroom" } });
console.log(`Cleanroom demo — session ${session.id} — ${AUTO ? "AUTO" : "INTERACTIVE"} mode`);
console.log(`Dataset: ${CSV_URL}\n`);

const request = `Clean this dataset end-to-end per your workflow: ${CSV_URL}
Download it in your sandbox, PROFILE it with measured counts, CLARIFY anything
ambiguous in one round, present the fix PLAN with previews and destructive steps
labeled, then STOP and wait for my explicit approval. Do not apply anything
before I approve. Delivery target: the sreenathmmenon/cleanroom repository.`;

let { tid, status } = await runTurn(session.id, [{ type: "user.message", content: request }], "PROFILE → CLARIFY → PLAN");

while (status === "done") {
  const again = await ask("Plan/next step shown. Approve and continue the cycle?");
  if (!again) break;
  ({ tid, status } = await runTurn(
    session.id,
    [{ type: "user.message", content: "Approved. Proceed with APPLY → VERIFY → DELIVER. Open the delivery pull request." }],
    "APPLY → VERIFY → DELIVER",
    tid,
  ));
}

say("Demo complete.");
