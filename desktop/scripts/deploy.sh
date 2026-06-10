#!/usr/bin/env bash
# Curl-able VOLT deployer:
#   Fresh deploy (interactive):
#     curl -fsSL https://raw.githubusercontent.com/voltlabs-research/volt/main/desktop/scripts/deploy.sh | bash
#   Update an existing deployment to latest (non-interactive, keeps your data):
#     curl -fsSL https://raw.githubusercontent.com/voltlabs-research/volt/main/desktop/scripts/deploy.sh | bash -s -- --update
#   Preview what an update would change without touching anything:
#     curl -fsSL .../deploy.sh | bash -s -- --check
# Optional with --update: --server-only / --with-cluster (switch + persist the mode),
# --force (rebuild even if already on the latest release).
# Brings up VOLT (server + client) and, unless server-only, a ClusterDaemon on this
# machine. The CLI prompts interactively for host/account/team/cluster on a fresh
# deploy; --update/--check run headless (no terminal required).
# Runs a compiled single-file bundle (dist/cli.cjs) — no TS toolchain at runtime.
set -euo pipefail

REPO_URL="${VOLT_REPO_URL:-https://github.com/voltlabs-research/volt}"
WORKDIR="${VOLT_DEPLOY_DIR:-$HOME/.volt-deploy}"
CLI_URL="${VOLT_CLI_URL:-${REPO_URL%/}/releases/latest/download/cli.cjs}"
COMPOSE_URL="${VOLT_COMPOSE_URL:-${REPO_URL%/}/releases/latest/download/compose.yml}"

# Non-interactive subcommands issue no prompts, so they must NOT demand a terminal
# (cron/systemd/CI have no /dev/tty, and attaching it aborts under `set -e`).
INTERACTIVE=1
for arg in "$@"; do
    case "$arg" in
        --update|--check|--help|-h) INTERACTIVE=0 ;;
    esac
done

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Required command not found: $1" >&2; exit 1; }; }
need docker; need node; need curl

# Docker must be installed AND its daemon reachable (not just on PATH).
if ! docker info >/dev/null 2>&1; then
    echo "Docker is installed but its daemon isn't reachable. Start Docker and retry." >&2
    echo "  Linux: sudo systemctl start docker" >&2
    exit 1
fi

mkdir -p "$WORKDIR"

# Pin the CLI's data dir to WORKDIR so app-config.json + downloads/ live alongside the
# downloaded bundle, independent of the cwd curl|bash happened to run in. Without this
# the config lands in $PWD/.volt-deploy and a later --update from another directory
# can't find prior state. Honor an operator-set VOLT_DEPLOY_DATA if present.
export VOLT_DEPLOY_DATA="${VOLT_DEPLOY_DATA:-$WORKDIR}"

# Download the prebuilt single-file bundle + compose (no clone, no TS toolchain).
# Retry on transient CDN errors (e.g. GitHub 504) so the pipeline doesn't abort.
echo "Downloading VOLT CLI (this can take a moment)…"
curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 "$CLI_URL" -o "$WORKDIR/cli.cjs"
echo "Downloading compose file…"
curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 "$COMPOSE_URL" -o "$WORKDIR/compose.yml"
echo "Starting VOLT deployer…"

# Interactive fresh deploy needs the terminal for prompts even when piped from curl;
# headless subcommands read no input.
if [ "$INTERACTIVE" = 1 ] && [ -e /dev/tty ]; then
    VOLT_COMPOSE_FILE="$WORKDIR/compose.yml" node "$WORKDIR/cli.cjs" "$@" < /dev/tty
else
    VOLT_COMPOSE_FILE="$WORKDIR/compose.yml" node "$WORKDIR/cli.cjs" "$@" < /dev/null
fi
