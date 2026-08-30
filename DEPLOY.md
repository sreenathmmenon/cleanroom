# Deploying Cleanroom

A single container: TrueForge in standalone mode with the Cleanroom agent, its
skill, and its providers seeded on boot. A judge opening the URL finds Cleanroom
already in the Agents Library, with the sample corpora reachable by URL.

```bash
railway up            # from a linked project
```

Or point Railway at this repo — `railway.json` selects the Dockerfile builder
and health-checks `/healthz`.

## What gets set

| Variable | Value | Why |
|---|---|---|
| `HOST` | `0.0.0.0` | Baked into the image. TrueForge defaults to `localhost`, which makes a container silently unreachable — the single easiest way to get a deploy that builds and never answers |
| `PORT` | injected by the platform | Falls back to 8790 |
| `STANDALONE` | `true` | SQLite, no Postgres or Redis. One container instead of three |
| `MODEL_PROVIDER`, `MODEL_API_KEY` | your provider and key | Without these the agent cannot run |
| `MODEL_FQN` | e.g. `openai/gpt-5-6-sol` | Which model the agent uses |
| `DAYTONA_API_KEY` | optional | Container sandbox. Without it the agent still profiles and plans; see below |
| `GITHUB_TOKEN` | optional | The delivery gate. Without it every phase runs except the pull-request delivery |
| `SKILL_REF` | `main` | Which ref the git-backed skill loads from |

Set them with `railway variables --set 'KEY=value'`, never in the repo.

## What the container does on boot

`docker-entrypoint.sh` starts TrueForge, waits for `/healthz`, then runs
`configure.mjs` and `seed-agent.mjs` — the same steps a local user runs with
`npm run setup:all`. Both are idempotent, so a restart re-applies rather than
duplicating, and a failure in either is reported without taking the server down:
a running server a judge can inspect beats no server at all.

## Two constraints worth stating plainly

**1. No login.** TrueForge's only authentication is OIDC, and OIDC is ignored in
standalone mode — its own docs say so. So this deployment has no login, and
TrueForge's identity module treats every caller as admin when OIDC is off:

```js
function isAdmin(user) {
  if (!getOidcVerify()) { return true; }   // no OIDC ⇒ everyone is admin
}
```

Anyone with the URL can open Settings, where the model provider key is stored,
and can run agents against it. That is acceptable for a short-lived demo whose
URL is shared with judges and then torn down. It is not acceptable for anything
else. Getting a login instead means `STANDALONE=false`, which pulls in Postgres,
Redis, and an OIDC provider — and disables the local sandbox, since TrueForge
returns no sandbox provider in hosted mode without Daytona.

**Tear the deployment down after judging** (`railway down`), and rotate the model
key afterwards.

**2. Sandbox availability.** In standalone mode TrueForge can use a local
sandbox, but only when the host supports it — on Linux that needs `bwrap`,
`socat`, and `rg` plus namespace privileges most container runtimes do not grant.
So in practice a container deployment wants `DAYTONA_API_KEY` set.

A Daytona key needs **Snapshots write** permission — "Sandboxes Access" alone is
not enough. A key without it authenticates fine and still fails, because
TrueForge validates by creating a snapshot:

```
GET  /api/snapshots  → 200   (read works)
POST /api/snapshots  → 403   Access denied
```

TrueForge surfaces that as `422 Daytona rejected the API key`, which reads like a
bad credential rather than a missing permission. If you see it, the key is real
but under-permissioned.

In the Daytona dashboard, create a key with **Restricted Access** and grant
Sandboxes write + delete, Snapshots write + delete, Registries write, and Volumes
read + write. Full Access works too but grants more than TrueForge needs.

Without a working sandbox the agent still intakes, plans, clarifies, and gates;
it cannot execute the profiling code, which is the part worth watching. Run
locally (`./scripts/setup.sh`) for the full cycle if the hosted sandbox is
unavailable.

## Verifying a deployment

```bash
curl -s https://<your-app>.up.railway.app/healthz
curl -s https://<your-app>.up.railway.app/api/v1/agents | head -c 200
```

The second should list `cleanroom`. If it is empty, the seed step failed — check
`railway logs` for the `configure` and `seed` sections.
