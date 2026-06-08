#!/usr/bin/env bash
# Curl-able VOLT deployer:
#   curl -fsSL https://raw.githubusercontent.com/voltlabs-research/volt/main/desktop/scripts/deploy.sh | bash
# Brings up VOLT (server + client) and, unless server-only, a ClusterDaemon on this
# machine. The CLI prompts interactively for host/account/team/cluster, then deploys.
# Runs a compiled single-file bundle (dist/cli.cjs) — no TS toolchain at runtime.
set -euo pipefail

REPO_URL="${VOLT_REPO_URL:-https://github.com/voltlabs-research/volt}"
WORKDIR="${VOLT_DEPLOY_DIR:-$HOME/.volt-deploy}"
CLI_URL="${VOLT_CLI_URL:-${REPO_URL%/}/releases/latest/download/cli.cjs}"
COMPOSE_URL="${VOLT_COMPOSE_URL:-${REPO_URL%/}/releases/latest/download/compose.yml}"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Required command not found: $1" >&2; exit 1; }; }
need docker; need node; need curl

# Docker must be installed AND its daemon reachable (not just on PATH).
if ! docker info >/dev/null 2>&1; then
    echo "Docker is installed but its daemon isn't reachable. Start Docker and retry." >&2
    echo "  Linux: sudo systemctl start docker" >&2
    exit 1
fi

mkdir -p "$WORKDIR"

# Download the prebuilt single-file bundle + compose (no clone, no TS toolchain).
curl -fsSL "$CLI_URL" -o "$WORKDIR/cli.cjs"
curl -fsSL "$COMPOSE_URL" -o "$WORKDIR/compose.yml"

# Attach the terminal so the interactive prompts work even when piped from curl.
VOLT_COMPOSE_FILE="$WORKDIR/compose.yml" node "$WORKDIR/cli.cjs" < /dev/tty
