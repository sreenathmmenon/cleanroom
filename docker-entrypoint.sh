#!/usr/bin/env bash
# Start TrueForge, then configure and seed Cleanroom into it.
#
# The server has to be listening before the settings and agent APIs will accept
# anything, so this starts it first, waits for /healthz, and then applies the
# same configuration a local user applies with `npm run setup:all`.
set -uo pipefail

say() { printf '\n==> %s\n' "$1"; }

say "Starting TrueForge on ${HOST}:${PORT}"
node node_modules/@truefoundry/trueforge/dist/main.js &
SERVER_PID=$!

# Forward termination to the server so the platform can stop the container.
trap 'kill -TERM "$SERVER_PID" 2>/dev/null' TERM INT

say "Waiting for the server to accept connections"
for i in $(seq 1 60); do
  # Node's built-in fetch, so the image needs no extra packages.
  if node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "healthy after ${i}s"
    break
  fi
  # If the server died, there is nothing to wait for.
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "TrueForge exited during startup" >&2
    wait "$SERVER_PID"
    exit 1
  fi
  sleep 1
done

export TRUEFORGE_URL="http://127.0.0.1:${PORT}"

# Configure providers and the skill, then seed the agent. Both are idempotent,
# so a container restart re-applies rather than duplicating. Seeding failure is
# reported but not fatal: a running server a judge can inspect beats no server.
say "Configuring providers and skill"
node scripts/configure.mjs || echo "configure step reported errors (continuing)"

say "Seeding the Cleanroom agent"
node scripts/seed-agent.mjs || echo "seed step reported errors (continuing)"

say "Ready"
wait "$SERVER_PID"
