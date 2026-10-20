#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${VOLT_REPO_URL:-https://github.com/voltlabs-research/volt}"
WORKDIR="${VOLT_DEPLOY_DIR:-$HOME/.volt-deploy}"
CLI_URL="${VOLT_CLI_URL:-${REPO_URL%/}/releases/latest/download/cli.cjs}"
COMPOSE_URL="${VOLT_COMPOSE_URL:-${REPO_URL%/}/releases/latest/download/compose.yml}"

INTERACTIVE=1
for arg in "$@"; do
    case "$arg" in
        --update|--check|--help|-h) INTERACTIVE=0 ;;
    esac
done

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Required command not found: $1" >&2; exit 1; }; }
need docker; need node; need curl

if ! docker info >/dev/null 2>&1; then
    echo "Docker is installed but its daemon isn't reachable. Start Docker and retry." >&2
    echo "  Linux: sudo systemctl start docker" >&2
    exit 1
fi

mkdir -p "$WORKDIR"

export VOLT_DEPLOY_DATA="${VOLT_DEPLOY_DATA:-$WORKDIR}"

echo "Downloading VOLT CLI (this can take a moment)…"
curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 "$CLI_URL" -o "$WORKDIR/cli.cjs"
echo "Downloading compose file…"
curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 "$COMPOSE_URL" -o "$WORKDIR/compose.yml"
echo "Starting VOLT deployer…"

if [ "$INTERACTIVE" = 1 ] && [ -e /dev/tty ]; then
    VOLT_COMPOSE_FILE="$WORKDIR/compose.yml" node "$WORKDIR/cli.cjs" "$@" < /dev/tty
else
    VOLT_COMPOSE_FILE="$WORKDIR/compose.yml" node "$WORKDIR/cli.cjs" "$@" < /dev/null
fi
