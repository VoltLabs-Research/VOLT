#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_SOURCE_PATH="$(cd -- "$SCRIPT_DIR/.." && pwd)"
DEFAULT_INSTALL_ROOT='/opt/volt/team-clusters'
DEFAULT_DEPLOY_USER="${TEAM_CLUSTER_DEPLOY_USER:-volt}"

CLUSTER_ID=''
INSTALL_ROOT="$DEFAULT_INSTALL_ROOT"
SOURCE_PATH="$DEFAULT_SOURCE_PATH"
DEPLOY_USER="$DEFAULT_DEPLOY_USER"
TEMP_DIR=''
CURRENT_USER=''
DOCKER_BIN=''
PYTHON_BIN=''

declare -a COMPOSE_ARGS=()
declare -A BEFORE_SERVICE_CONTAINER_IDS=()

usage() {
    cat <<EOF
Usage: bash scripts/rebuild-installed-daemon.sh --cluster-id <cluster-id> [options]

Rebuilds the installed cluster daemon from a local source checkout and recreates
only the 'daemon' service for an existing installed cluster.

Options:
  --cluster-id <id>       Installed cluster identifier.
  --install-root <path>   Cluster install root. Default: $DEFAULT_INSTALL_ROOT
  --source-path <path>    Local ClusterDaemon source path. Default: $DEFAULT_SOURCE_PATH
  --deploy-user <user>    Linux deployment user for docker compose. Default: $DEFAULT_DEPLOY_USER
  --help                  Show this help message.

Examples:
  bash scripts/rebuild-installed-daemon.sh --cluster-id 69b20648911ca488bbb759bb
  bash scripts/rebuild-installed-daemon.sh --cluster-id 69b20648911ca488bbb759bb \\
      --install-root /opt/volt/team-clusters \\
      --source-path /home/user/dev/voltlabs-ecosystem/app/ClusterDaemon
EOF
}

log() {
    printf '[rebuild-daemon] %s\n' "$1"
}

fail() {
    printf '[rebuild-daemon] %s\n' "$1" >&2
    exit 1
}

cleanup() {
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}

require_command() {
    local command_name="$1"

    if ! command -v "$command_name" >/dev/null 2>&1; then
        fail "Missing required command: $command_name"
    fi
}

ensure_temp_dir() {
    if [ -n "$TEMP_DIR" ]; then
        return
    fi

    TEMP_DIR="$(mktemp -d)"
    chmod 755 "$TEMP_DIR"
}

normalize_path_value() {
    local raw_value="$1"

    if [ "$raw_value" = '/' ]; then
        printf '/\n'
        return
    fi

    raw_value="${raw_value%/}"
    raw_value="${raw_value%\\}"
    printf '%s\n' "$raw_value"
}

resolve_absolute_path() {
    local raw_path="$1"

    python3 - "$raw_path" <<'PY'
import os
import sys

print(os.path.abspath(sys.argv[1]))
PY
}

parse_arguments() {
    while [ "$#" -gt 0 ]; do
        case "$1" in
            --cluster-id)
                [ "$#" -ge 2 ] || fail 'Missing value for --cluster-id'
                CLUSTER_ID="$2"
                shift 2
                ;;
            --install-root)
                [ "$#" -ge 2 ] || fail 'Missing value for --install-root'
                INSTALL_ROOT="$2"
                shift 2
                ;;
            --source-path)
                [ "$#" -ge 2 ] || fail 'Missing value for --source-path'
                SOURCE_PATH="$2"
                shift 2
                ;;
            --deploy-user)
                [ "$#" -ge 2 ] || fail 'Missing value for --deploy-user'
                DEPLOY_USER="$2"
                shift 2
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                if [ -z "$CLUSTER_ID" ]; then
                    CLUSTER_ID="$1"
                    shift
                    continue
                fi

                fail "Unknown argument: $1"
                ;;
        esac
    done

    if [ -z "$CLUSTER_ID" ]; then
        usage
        fail 'Missing required argument: --cluster-id'
    fi
}

docker_compose() {
    run_as_stack_user "$DOCKER_BIN" compose "${COMPOSE_ARGS[@]}" "$@"
}

is_linux_host() {
    [ "$(uname -s)" = 'Linux' ]
}

resolve_current_user() {
    CURRENT_USER="$(id -un)"
}

join_path() {
    local base_path="$1"
    local child_path="$2"

    if [ "$base_path" = '/' ]; then
        printf '/%s\n' "$child_path"
        return
    fi

    printf '%s/%s\n' "$base_path" "$child_path"
}

ensure_stack_user_switching() {
    if ! is_linux_host || [ "$CURRENT_USER" = "$DEPLOY_USER" ]; then
        return
    fi

    if [ "$(id -u)" -eq 0 ]; then
        if command -v runuser >/dev/null 2>&1 || command -v sudo >/dev/null 2>&1; then
            return
        fi

        fail "Linux rebuilds must run as '$DEPLOY_USER' or have runuser/sudo available to switch users"
    fi

    if ! command -v sudo >/dev/null 2>&1; then
        fail "Linux rebuilds must run as '$DEPLOY_USER' or with sudo available to switch users"
    fi

    if ! sudo -v; then
        fail "Unable to acquire sudo access to switch to deployment user '$DEPLOY_USER'"
    fi
}

run_as_stack_user() {
    if ! is_linux_host || [ "$CURRENT_USER" = "$DEPLOY_USER" ]; then
        "$@"
        return
    fi

    if [ "$(id -u)" -eq 0 ] && command -v runuser >/dev/null 2>&1; then
        runuser -u "$DEPLOY_USER" -- "$@"
        return
    fi

    if command -v sudo >/dev/null 2>&1; then
        sudo -H -u "$DEPLOY_USER" -- "$@"
        return
    fi

    fail "Linux rebuilds must run as '$DEPLOY_USER' or with sudo/runuser available to switch users"
}

ensure_linux_deploy_user() {
    if ! is_linux_host; then
        return
    fi

    if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
        fail "Linux deployment user '$DEPLOY_USER' does not exist. Pass --deploy-user or set TEAM_CLUSTER_DEPLOY_USER to match the installed cluster owner."
    fi
}

ensure_stack_access() {
    local install_dir="$1"
    local compose_file="$2"
    local source_path="$3"
    local override_file="$4"

    if ! run_as_stack_user "$DOCKER_BIN" compose version >/dev/null 2>&1; then
        fail "Docker Compose is not available for deployment user '$DEPLOY_USER'"
    fi

    if ! run_as_stack_user "$DOCKER_BIN" info >/dev/null 2>&1; then
        fail "Docker is not accessible for deployment user '$DEPLOY_USER'. Run the rebuild as that user or grant it Docker access."
    fi

    if ! run_as_stack_user "$PYTHON_BIN" - "$install_dir" "$compose_file" "$source_path" "$override_file" <<'PY'
import os
import pathlib
import pwd
import sys

checks = [
    ('directory', pathlib.Path(sys.argv[1]), os.R_OK | os.X_OK),
    ('file', pathlib.Path(sys.argv[2]), os.R_OK),
    ('directory', pathlib.Path(sys.argv[3]), os.R_OK | os.X_OK),
    ('file', pathlib.Path(sys.argv[3]) / 'Dockerfile', os.R_OK),
    ('file', pathlib.Path(sys.argv[3]) / 'package.json', os.R_OK),
    ('file', pathlib.Path(sys.argv[4]), os.R_OK)
]
effective_user = pwd.getpwuid(os.geteuid()).pw_name
errors = []

for entry_type, path, mode in checks:
    if entry_type == 'directory':
        exists = path.is_dir()
    else:
        exists = path.is_file()

    if not exists:
        errors.append(f'{path} is missing')
        continue

    if not os.access(path, mode):
        errors.append(f'{effective_user} cannot access {path}')

if errors:
    for error in errors:
        print(error, file=sys.stderr)
    sys.exit(1)
PY
    then
        fail "Deployment user '$DEPLOY_USER' cannot access the cluster files or local source path required for the rebuild"
    fi
}

get_compose_project_name() {
    local project_name_file="$1/.compose-project-name"

    if [ ! -f "$project_name_file" ]; then
        fail "Missing compose project name file: $project_name_file"
    fi

    local project_name
    project_name="$(head -n 1 "$project_name_file" | tr -d '\r')"

    if [ -z "$project_name" ]; then
        fail "Compose project name file is empty: $project_name_file"
    fi

    printf '%s\n' "$project_name"
}

create_override_file() {
    local override_file="$1"
    local source_path="$2"

    "$PYTHON_BIN" - "$override_file" "$source_path" <<'PY'
import json
import pathlib
import sys

override_path = pathlib.Path(sys.argv[1])
source_path = pathlib.Path(sys.argv[2]).resolve()

override_path.write_text(
    (
        "services:\n"
        "  daemon:\n"
        "    build:\n"
        f"      context: {json.dumps(source_path.as_posix())}\n"
        "      dockerfile: Dockerfile\n"
    ),
    encoding='utf-8'
)
override_path.chmod(0o644)
PY
}

verify_paths() {
    local install_dir="$1"
    local compose_file="$2"
    local source_path="$3"

    [ -d "$install_dir" ] || fail "Installed cluster directory not found: $install_dir"
    [ -f "$compose_file" ] || fail "Cluster compose file not found: $compose_file"
    [ -d "$source_path" ] || fail "Local daemon source path not found: $source_path"
    [ -f "$source_path/Dockerfile" ] || fail "Dockerfile not found in source path: $source_path/Dockerfile"
    [ -f "$source_path/package.json" ] || fail "package.json not found in source path: $source_path/package.json"
}

ensure_daemon_service_exists() {
    local daemon_service_name='daemon'

    if ! docker_compose config --services | grep -qx "$daemon_service_name"; then
        fail "Compose file does not define the '$daemon_service_name' service"
    fi
}

capture_non_daemon_service_state() {
    local service_name

    while IFS= read -r service_name; do
        if [ "$service_name" = 'daemon' ]; then
            continue
        fi

        BEFORE_SERVICE_CONTAINER_IDS["$service_name"]="$(docker_compose ps -q "$service_name" | tr '\n' ',' | sed 's/,$//')"
    done < <(docker_compose config --services)
}

verify_non_daemon_services_unchanged() {
    local service_name before_container_ids after_container_ids

    for service_name in "${!BEFORE_SERVICE_CONTAINER_IDS[@]}"; do
        before_container_ids="${BEFORE_SERVICE_CONTAINER_IDS[$service_name]}"
        after_container_ids="$(docker_compose ps -q "$service_name" | tr '\n' ',' | sed 's/,$//')"

        if [ "$before_container_ids" != "$after_container_ids" ]; then
            fail "Non-daemon service changed during rebuild: $service_name"
        fi
    done
}

main() {
    trap cleanup EXIT

    parse_arguments "$@"

    require_command docker
    require_command python3

    DOCKER_BIN="$(command -v docker)"
    PYTHON_BIN="$(command -v python3)"
    resolve_current_user
    ensure_linux_deploy_user
    ensure_stack_user_switching

    INSTALL_ROOT="$(normalize_path_value "$INSTALL_ROOT")"
    INSTALL_ROOT="$(resolve_absolute_path "$INSTALL_ROOT")"
    SOURCE_PATH="$(resolve_absolute_path "$(normalize_path_value "$SOURCE_PATH")")"

    local install_dir compose_file compose_project_name override_file
    local daemon_container_before daemon_container_after

    install_dir="$(join_path "$INSTALL_ROOT" "$CLUSTER_ID")"
    compose_file="${install_dir}/docker-compose.yml"

    verify_paths "$install_dir" "$compose_file" "$SOURCE_PATH"

    compose_project_name="$(get_compose_project_name "$install_dir")"

    ensure_temp_dir
    override_file="${TEMP_DIR}/docker-compose.local-daemon-build.override.yml"

    create_override_file "$override_file" "$SOURCE_PATH"
    COMPOSE_ARGS=(
        --project-name "$compose_project_name"
        --project-directory "$install_dir"
        --file "$compose_file"
        --file "$override_file"
    )
    ensure_stack_access "$install_dir" "$compose_file" "$SOURCE_PATH" "$override_file"

    ensure_daemon_service_exists

    daemon_container_before="$(docker_compose ps -q daemon | head -n 1)"

    capture_non_daemon_service_state

    log "Cluster directory: $install_dir"
    log "Compose project: $compose_project_name"
    if is_linux_host; then
        log "Deployment user: $DEPLOY_USER"
    fi
    log "Local daemon source: $SOURCE_PATH"
    log 'Using a temporary compose override to inject the local daemon build context'
    log 'Building the daemon image from local source'
    docker_compose build daemon

    log "Recreating only the 'daemon' service"
    docker_compose up -d --no-deps --force-recreate daemon

    daemon_container_after="$(docker_compose ps -q daemon | head -n 1)"

    verify_non_daemon_services_unchanged

    if [ -n "$daemon_container_before" ] && [ "$daemon_container_before" != "$daemon_container_after" ]; then
        log "Daemon container recreated: ${daemon_container_before} -> ${daemon_container_after}"
    elif [ -n "$daemon_container_after" ]; then
        log "Daemon container id: $daemon_container_after"
    else
        log 'Daemon container has not been created yet. Check docker compose output above.'
    fi

    log 'Local daemon rebuild complete. No non-daemon services were modified.'
}

main "$@"
