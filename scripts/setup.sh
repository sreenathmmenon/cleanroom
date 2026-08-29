#!/usr/bin/env bash
# Cleanroom local setup: verify prerequisites and launch TrueForge in local mode.
set -euo pipefail

say() { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }

say "Checking prerequisites"
command -v node >/dev/null || { echo "Node.js is required (22+). https://nodejs.org"; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Node 22+ required, found $(node --version)."; exit 1
fi
echo "Node $(node --version) ✓"

say "Launching TrueForge (local mode)"
echo "First run downloads the package (~1 min). UI: http://localhost:3000"
echo "In the TrueForge UI, configure once (Settings → ...):"
echo "  1. Models   — add a provider API key"
echo "  2. Sandbox  — add the Daytona API key (free tier: https://daytona.io)"
echo "  3. Connectors — add an MCP 'filesystem' server scoped to a workspace dir"
echo "  4. Skills   — add the git skill: repo <this repo>, path skills/data-cleaning"
echo ""
echo "Then, in another terminal:  npm run seed"
npx --yes @truefoundry/trueforge@latest
