#!/usr/bin/env bash
# Curl-able VOLT deployer:
#   curl -fsSL https://raw.githubusercontent.com/voltlabs-research/volt/main/desktop/scripts/deploy.sh | bash
# Brings up VOLT (server + client) and, unless server-only, a ClusterDaemon on this
# machine. The CLI prompts interactively for host/account/team/cluster, then deploys.
# Runs a compiled single-file bundle (dist/cli.cjs) — no TS toolchain at runtime.
set -euo pipefail

REPO_URL="${VOLT_REPO_URL:-https://github.com/voltlabs-research/volt}"
WORKDIR="${VOLT_DEPLOY_DIR:-$HOME/.volt-deploy}"
SRC="$WORKDIR/volt"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Required command not found: $1" >&2; exit 1; }; }
need docker; need node; need curl

# Docker must be installed AND its daemon reachable (not just on PATH).
if ! docker info >/dev/null 2>&1; then
    echo "Docker is installed but its daemon isn't reachable. Start Docker and retry." >&2
    echo "  Linux: sudo systemctl start docker" >&2
    exit 1
fi

mkdir -p "$WORKDIR"

if [ -n "${VOLT_CLI_URL:-}" ]; then
    # Fast path: download the prebuilt bundle + compose (no clone / install).
    curl -fsSL "$VOLT_CLI_URL" -o "$WORKDIR/cli.cjs"
    curl -fsSL "${VOLT_COMPOSE_URL:-${REPO_URL%/}/raw/main/desktop/stack/compose.yml}" -o "$WORKDIR/compose.yml"
    ENTRY="$WORKDIR/cli.cjs"; COMPOSE="$WORKDIR/compose.yml"
else
    # Build the single-file bundle from source once (skips Electron devdeps).
    need git
    if [ -d "$SRC/.git" ]; then git -C "$SRC" pull --ff-only; else git clone --depth 1 "$REPO_URL" "$SRC"; fi
    cd "$SRC/desktop"
    npm ci --omit=dev
    npm run cli:build
    ENTRY="$SRC/desktop/dist/cli.cjs"; COMPOSE="$SRC/desktop/stack/compose.yml"
fi

# Attach the terminal so the interactive prompts work even when piped from curl.
VOLT_COMPOSE_FILE="$COMPOSE" node "$ENTRY" < /dev/tty
