    #!/usr/bin/env bash
    set -euo pipefail

    TEAM_CLUSTER_ID="${1:-}"
    ENROLLMENT_TOKEN="${2:-}"
    INSTALL_VERSION="1.0.0"
    DEPLOY_USER="volt"
    INSTALL_ROOT=""
    INSTALL_DIR=""
    TEMP_DIR=""
    DAEMON_PASSWORD=""
    PORTS_JSON=""
    MANIFEST_FILE=""
    PLATFORM=""
    OS_ID="unknown"
    OS_ID_LIKE=""
    LOCAL_USER=""
    LOCAL_HOME=""
    SUDO=""

    usage() {
        printf 'Usage: bash install.sh <team-cluster-id> <enrollment-token>\n' >&2
    }

    log() {
        printf '[install] %s\n' "$1"
    }

    fail() {
        printf '[install] %s\n' "$1" >&2
        exit 1
    }

    require_argument() {
        local value="$1"
        local name="$2"

        if [ -z "$value" ]; then
            usage
            fail "Missing required argument: $name"
        fi
    }

    require_command() {
        local command_name="$1"

        if ! command -v "$command_name" >/dev/null 2>&1; then
            fail "Missing required command: $command_name"
        fi
    }

    ensure_temp_dir() {
        if [ -z "$TEMP_DIR" ]; then
            TEMP_DIR="$(mktemp -d)"
        fi
    }

    cleanup() {
        if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
            rm -rf "$TEMP_DIR"
        fi
    }

    on_error() {
        log 'Installation failed'
    }

    resolve_local_user() {
        if [ "$(id -u)" -eq 0 ] && [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != 'root' ]; then
            LOCAL_USER="$SUDO_USER"
        else
            LOCAL_USER="$(id -un)"
        fi

        if [ "$LOCAL_USER" = 'root' ]; then
            LOCAL_HOME="$HOME"
            return
        fi

        if command -v getent >/dev/null 2>&1; then
            LOCAL_HOME="$(getent passwd "$LOCAL_USER" | cut -d: -f6)"
        elif command -v dscl >/dev/null 2>&1; then
            LOCAL_HOME="$(dscl . -read "/Users/$LOCAL_USER" NFSHomeDirectory | awk '{print $2}')"
        else
            LOCAL_HOME="$HOME"
        fi

        if [ -z "$LOCAL_HOME" ]; then
            fail "Unable to determine the home directory for user $LOCAL_USER"
        fi
    }

    normalize_path_value() {
        local raw_value="$1"
        raw_value="${raw_value%/}"
        raw_value="${raw_value%\\}"
        printf '%s\n' "$raw_value"
    }

    http_post_json() {
        local url="$1"
        local payload="$2"
        local body_file status_code

        ensure_temp_dir
        body_file="$(mktemp "$TEMP_DIR/response.XXXXXX.json")"

        status_code="$(curl -sS -o "$body_file" -w '%{http_code}' -X POST "$url" -H 'Content-Type: application/json' --data "$payload")"

        if [ "$status_code" -lt 200 ] || [ "$status_code" -ge 300 ]; then
            python3 - "$body_file" "$status_code" <<'PY'
import json
import pathlib
import sys

body_path = pathlib.Path(sys.argv[1])
status_code = sys.argv[2]
raw = body_path.read_text(encoding='utf-8')

try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print(f'HTTP {status_code}: {raw}', file=sys.stderr)
    sys.exit(1)

message = data.get('message') or data.get('code') or raw
print(f'HTTP {status_code}: {message}', file=sys.stderr)
sys.exit(1)
PY
            exit 1
        fi

        printf '%s\n' "$body_file"
    }

    parse_json_field() {
        local file_path="$1"
        local expression="$2"

        python3 - "$file_path" "$expression" <<'PY'
import json
import sys

payload = json.load(open(sys.argv[1], 'r', encoding='utf-8'))
expression = sys.argv[2].split('.')
current = payload

for part in expression:
    current = current[part]

if isinstance(current, str):
    print(current)
else:
    print(json.dumps(current))
PY
    }

    detect_platform() {
        local uname_value
        uname_value="$(uname -s)"

        case "$uname_value" in
            Linux)
                PLATFORM='linux'
                ;;
            Darwin)
                PLATFORM='darwin'
                ;;
            CYGWIN*|MINGW*|MSYS*)
                fail 'Windows hosts must use the PowerShell installer instead of install.sh'
                ;;
            *)
                fail "Unsupported operating system: $uname_value"
                ;;
        esac
    }

    detect_linux_distribution() {
        if [ "$PLATFORM" != 'linux' ]; then
            return
        fi

        if [ -r /etc/os-release ]; then
            # shellcheck disable=SC1091
            . /etc/os-release
            OS_ID="${ID:-unknown}"
            OS_ID_LIKE="${ID_LIKE:-}"
            VERSION_CODENAME="${VERSION_CODENAME:-}"
        fi
    }

    ensure_supported_architecture() {
        local architecture
        architecture="$(uname -m)"

        case "$architecture" in
            x86_64|amd64|aarch64|arm64)
                return
                ;;
        esac

        fail "Unsupported architecture: $architecture"
    }

    set_install_root() {
        local configured_root="${TEAM_CLUSTER_INSTALL_ROOT:-}"
        if [ -n "$configured_root" ]; then
            INSTALL_ROOT="$(normalize_path_value "$configured_root")"
            return
        fi

        if [ "$PLATFORM" = 'linux' ]; then
            INSTALL_ROOT='/opt/volt/team-clusters'
            return
        fi

        INSTALL_ROOT="$(normalize_path_value "$LOCAL_HOME/Library/Application Support/Volt/team-clusters")"
    }

    ensure_privileges() {
        if [ "$(id -u)" -eq 0 ]; then
            SUDO=''
            return
        fi

        if ! command -v sudo >/dev/null 2>&1; then
            fail 'This installer requires root or sudo access'
        fi

        SUDO='sudo'
        $SUDO -v
    }

    host_docker() {
        if [ "$PLATFORM" = 'linux' ] && [ -n "$SUDO" ]; then
            $SUDO docker "$@"
            return
        fi

        docker "$@"
    }

    docker_available() {
        command -v docker >/dev/null 2>&1
    }

    docker_compose_available() {
        if ! docker_available; then
            return 1
        fi

        host_docker compose version >/dev/null 2>&1
    }

    docker_runtime_ready() {
        host_docker version >/dev/null 2>&1 \
            && host_docker info >/dev/null 2>&1 \
            && host_docker compose version >/dev/null 2>&1
    }

    wait_for_docker_ready() {
        local timeout_seconds="300"
        local started_at
        started_at="$(date +%s)"

        log 'Waiting for Docker daemon and Compose to become ready'

        while :; do
            if docker_runtime_ready; then
                log 'Docker is ready'
                return
            fi

            if [ $(( $(date +%s) - started_at )) -ge "$timeout_seconds" ]; then
                fail "Docker did not become ready within ${timeout_seconds}s"
            fi

            sleep 5
        done
    }

    install_docker_on_debian() {
        log 'Installing Docker Engine and Compose plugin for Debian-based Linux'
        $SUDO apt-get update
        $SUDO apt-get install -y ca-certificates curl gnupg python3
        $SUDO install -m 0755 -d /etc/apt/keyrings
        curl -fsSL "https://download.docker.com/linux/${OS_ID}/gpg" | $SUDO gpg --yes --dearmor -o /etc/apt/keyrings/docker.gpg
        $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
        printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/%s %s stable\n' \
            "$(dpkg --print-architecture)" \
            "$OS_ID" \
            "$VERSION_CODENAME" | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null
        $SUDO apt-get update
        $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    }

    install_docker_on_fedora_like() {
        local repo_id='centos'
        if [ "$OS_ID" = 'fedora' ]; then
            repo_id='fedora'
        fi

        log 'Installing Docker Engine and Compose plugin for Fedora/RHEL-like Linux'
        if command -v dnf >/dev/null 2>&1; then
            $SUDO dnf install -y dnf-plugins-core python3
            $SUDO dnf config-manager --add-repo "https://download.docker.com/linux/${repo_id}/docker-ce.repo"
            $SUDO dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            return
        fi

        if command -v yum >/dev/null 2>&1; then
            $SUDO yum install -y yum-utils python3
            $SUDO yum-config-manager --add-repo "https://download.docker.com/linux/${repo_id}/docker-ce.repo"
            $SUDO yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            return
        fi

        fail 'Automatic Docker installation requires dnf or yum on this Linux host'
    }

    start_linux_docker_service() {
        if ! command -v systemctl >/dev/null 2>&1; then
            fail 'Automatic Docker installation requires systemctl on supported Linux hosts'
        fi

        $SUDO systemctl enable --now docker
    }

    ensure_docker_linux() {
        if docker_available && docker_compose_available; then
            log 'Docker CLI and Compose plugin already detected'
            wait_for_docker_ready
            return
        fi

        detect_linux_distribution

        case "$OS_ID" in
            ubuntu|debian)
                if [ -z "${VERSION_CODENAME:-}" ]; then
                    fail 'Unable to determine Debian/Ubuntu release codename for Docker repository setup'
                fi
                install_docker_on_debian
                ;;
            fedora|rhel|rocky|almalinux|centos)
                install_docker_on_fedora_like
                ;;
            *)
                case "$OS_ID_LIKE" in
                    *debian*)
                        if [ -z "${VERSION_CODENAME:-}" ]; then
                            fail 'Unable to determine Debian-like release codename for Docker repository setup'
                        fi
                        install_docker_on_debian
                        ;;
                    *rhel*|*fedora*)
                        install_docker_on_fedora_like
                        ;;
                    *)
                        fail "Automatic Docker installation is not supported on this Linux distribution (${OS_ID})"
                        ;;
                esac
                ;;
        esac

        start_linux_docker_service
        wait_for_docker_ready
    }

    ensure_interactive_macos_session() {
        if [ -n "${CI:-}" ] || [ -n "${SSH_TTY:-}" ]; then
            fail 'Automatic Docker Desktop installation on macOS requires an interactive desktop session'
        fi
    }

    install_docker_on_macos_with_brew() {
        log 'Installing Docker Desktop with Homebrew'
        brew install --cask docker
    }

    install_docker_on_macos_official() {
        local architecture download_arch dmg_path mount_output volume_path

        architecture="$(uname -m)"
        case "$architecture" in
            arm64|aarch64)
                download_arch='arm64'
                ;;
            x86_64|amd64)
                download_arch='amd64'
                ;;
            *)
                fail "Unsupported macOS architecture for Docker Desktop: $architecture"
                ;;
        esac

        ensure_temp_dir
        dmg_path="$TEMP_DIR/docker-desktop.dmg"
        log 'Downloading Docker Desktop for macOS'
        curl -fsSL "https://desktop.docker.com/mac/main/${download_arch}/Docker.dmg" -o "$dmg_path"

        mount_output="$(hdiutil attach "$dmg_path" -nobrowse)"
        volume_path="$(printf '%s\n' "$mount_output" | awk '/\/Volumes\// {print $NF; exit}')"
        if [ -z "$volume_path" ] || [ ! -d "$volume_path/Docker.app" ]; then
            fail 'Failed to mount the Docker Desktop installer image on macOS'
        fi

        log 'Installing Docker Desktop.app'
        $SUDO rm -rf /Applications/Docker.app
        $SUDO ditto "$volume_path/Docker.app" /Applications/Docker.app
        hdiutil detach "$volume_path" -quiet >/dev/null 2>&1 || true

        if ! command -v python3 >/dev/null 2>&1; then
            install_python3_on_macos_official
        fi
    }

    start_docker_desktop_macos() {
        if ! open -Ra Docker >/dev/null 2>&1; then
            fail 'Docker Desktop.app was not found after installation'
        fi

        log 'Launching Docker Desktop'
        open -a Docker
    }

    ensure_docker_macos() {
        if docker_runtime_ready; then
            log 'Docker CLI, daemon, and Compose already detected'
            return
        fi

        ensure_interactive_macos_session

        if docker_available && docker_compose_available; then
            start_docker_desktop_macos
            wait_for_docker_ready
            return
        fi

        if command -v brew >/dev/null 2>&1; then
            install_docker_on_macos_with_brew
        else
            install_docker_on_macos_official
        fi

        start_docker_desktop_macos
        wait_for_docker_ready
    }

    refresh_macos_python3_path() {
        local candidate

        if [ "$PLATFORM" != 'darwin' ]; then
            return
        fi

        for candidate in \
            '/usr/local/bin' \
            '/Library/Frameworks/Python.framework/Versions/Current/bin' \
            '/Library/Frameworks/Python.framework/Versions/3.13/bin' \
            '/Library/Frameworks/Python.framework/Versions/3.12/bin'; do
            if [ -x "$candidate/python3" ]; then
                PATH="$candidate:$PATH"
                export PATH
                return
            fi
        done
    }

    install_python3_on_macos_official() {
        local python_version pkg_path

        python_version='3.12.10'
        ensure_temp_dir
        pkg_path="$TEMP_DIR/python-${python_version}-macos.pkg"

        log 'Downloading Python 3 for macOS'
        curl -fsSL "https://www.python.org/ftp/python/${python_version}/python-${python_version}-macos11.pkg" -o "$pkg_path"

        log 'Installing Python 3 for macOS'
        $SUDO installer -pkg "$pkg_path" -target /
        refresh_macos_python3_path
    }

    ensure_runtime_capabilities() {
        if [ "$PLATFORM" = 'linux' ]; then
            ensure_docker_linux
            return
        fi

        if [ "$PLATFORM" = 'darwin' ]; then
            ensure_docker_macos
            return
        fi

        fail "Unsupported platform: $PLATFORM"
    }

    ensure_python3() {
        if command -v python3 >/dev/null 2>&1; then
            return
        fi

        if [ "$PLATFORM" = 'darwin' ]; then
            if command -v brew >/dev/null 2>&1; then
                log 'Installing python3 with Homebrew'
                brew install python
            else
                install_python3_on_macos_official
            fi
        fi

        refresh_macos_python3_path
        require_command python3
    }

    ensure_deploy_user() {
        if [ "$PLATFORM" = 'linux' ]; then
            if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
                log "Creating deployment user $DEPLOY_USER"
                $SUDO useradd --create-home --shell /bin/bash "$DEPLOY_USER"
            fi

            $SUDO usermod -aG docker "$DEPLOY_USER"
            $SUDO install -d -m 0755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$INSTALL_ROOT"
            return
        fi

        DEPLOY_USER="$LOCAL_USER"
        mkdir -p "$INSTALL_ROOT"
        if [ "$(id -u)" -eq 0 ] && [ "$LOCAL_USER" != 'root' ]; then
            chown "$LOCAL_USER" "$INSTALL_ROOT"
        fi
    }

    choose_ports() {
        PORTS_JSON="$(python3 <<'PY'
import json
import socket

services = ['minio', 'redis', 'mongodb', 'daemon']
ports = {}
sockets = []

for service in services:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(('0.0.0.0', 0))
    ports[service] = sock.getsockname()[1]
    sockets.append(sock)

print(json.dumps(ports))

for sock in sockets:
    sock.close()
PY
    )"
        export PORTS_JSON
    }

    send_healthcheck() {
        local payload response_file

        payload="$(python3 - "$ENROLLMENT_TOKEN" "$INSTALL_VERSION" <<'PY'
import json
import sys

print(json.dumps({
    'enrollmentToken': sys.argv[1],
    'installedVersion': sys.argv[2]
}))
PY
    )"

        response_file="$(http_post_json "${VOLT_CLOUD_URL}/api/team-clusters/${TEAM_CLUSTER_ID}/healthcheck" "$payload")"
        DAEMON_PASSWORD="$(parse_json_field "$response_file" 'data.daemonPassword')"
    }

    download_manifest() {
        local payload response_file

        payload="$(python3 - "$DAEMON_PASSWORD" "$INSTALL_ROOT" "$PORTS_JSON" <<'PY'
import json
import sys

print(json.dumps({
    'daemonPassword': sys.argv[1],
    'installRoot': sys.argv[2],
    'ports': json.loads(sys.argv[3])
}))
PY
    )"

        response_file="$(http_post_json "${VOLT_CLOUD_URL}/api/team-clusters/${TEAM_CLUSTER_ID}/install-manifest" "$payload")"
        MANIFEST_FILE="$response_file"
        export MANIFEST_FILE
    }

    materialize_manifest() {
        ensure_temp_dir
        INSTALL_DIR="${INSTALL_ROOT}/${TEAM_CLUSTER_ID}"
        export INSTALL_DIR

        if [ "$PLATFORM" = 'linux' ]; then
            $SUDO install -d -m 0755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$INSTALL_DIR"
        else
            mkdir -p "$INSTALL_DIR"
        fi

        local staging_dir
        staging_dir="$(mktemp -d "$TEMP_DIR/staging.XXXXXX")"

        python3 - "$MANIFEST_FILE" "$staging_dir" <<'PY'
import base64
import gzip
import io
import json
import os
import pathlib
import tarfile
import sys


def write_manifest_files(install_dir: pathlib.Path, files: list[dict[str, str]]) -> None:
    for file_entry in files:
        target_path = install_dir / file_entry['path']
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text(file_entry['contents'] + '\n', encoding='utf-8')
        os.chmod(target_path, int(file_entry['mode'], 8))


def materialize_build_context(install_dir: pathlib.Path, manifest: dict) -> None:
    archive_b64 = manifest.get('buildContextArchiveBase64')
    if not archive_b64:
        return

    cluster_daemon_dir = install_dir / 'cluster-daemon'
    cluster_daemon_dir.mkdir(parents=True, exist_ok=True)
    archive_bytes = gzip.decompress(base64.b64decode(archive_b64))

    with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode='r:') as tar:
        tar.extractall(cluster_daemon_dir, filter='data')

payload = json.load(open(sys.argv[1], 'r', encoding='utf-8'))
manifest = payload['data']['manifest']
install_dir = pathlib.Path(sys.argv[2])

write_manifest_files(install_dir, manifest['files'])

(install_dir / '.compose-project-name').write_text(manifest['composeProjectName'] + '\n')
(install_dir / '.install-manifest-version').write_text(manifest['manifestVersion'] + '\n')
materialize_build_context(install_dir, manifest)
PY

        if [ "$PLATFORM" = 'linux' ]; then
            $SUDO cp -r "$staging_dir/." "$INSTALL_DIR/"
            $SUDO chown -R "$DEPLOY_USER:$DEPLOY_USER" "$INSTALL_DIR"
            return
        fi

        cp -r "$staging_dir/." "$INSTALL_DIR/"
        if [ "$(id -u)" -eq 0 ] && [ "$LOCAL_USER" != 'root' ]; then
            chown -R "$LOCAL_USER" "$INSTALL_DIR"
        fi
    }

    run_stack_shell() {
        local command="$1"

        if [ "$PLATFORM" = 'linux' ]; then
            $SUDO -H -u "$DEPLOY_USER" sh -lc "$command"
            return
        fi

        if [ "$(id -u)" -eq 0 ] && [ "$LOCAL_USER" != 'root' ]; then
            sudo -H -u "$LOCAL_USER" sh -lc "$command"
            return
        fi

        sh -lc "$command"
    }

    pull_runtime_images() {
        log 'Pulling Jupyter runtime image'
        host_docker pull 'ghcr.io/voltlabs-research/volt-jupyter-scripting:main'
    }

    start_stack() {
        local compose_project_name
        compose_project_name="$(tr -d '\r\n' < "$INSTALL_DIR/.compose-project-name")"

        log 'Starting Team Cluster stack'
        run_stack_shell "cd '$INSTALL_DIR' && if [ -d '$INSTALL_DIR/cluster-daemon' ]; then docker compose --project-name '$compose_project_name' --project-directory '$INSTALL_DIR' --file '$INSTALL_DIR/docker-compose.yml' up -d --build; else docker compose --project-name '$compose_project_name' --project-directory '$INSTALL_DIR' --file '$INSTALL_DIR/docker-compose.yml' up -d; fi"
    }

    wait_for_daemon_ready() {
        local compose_project_name container_name timeout_seconds started_at

        compose_project_name="$(tr -d '\r\n' < "$INSTALL_DIR/.compose-project-name")"
        container_name="${compose_project_name}-daemon-1"
        timeout_seconds='90'
        started_at="$(date +%s)"

        log "Waiting for daemon readiness (container: $container_name)"

        while :; do
            if host_docker logs "$container_name" 2>&1 | grep -q 'cluster-daemon started for team cluster'; then
                log 'Daemon is ready'
                return
            fi

            if [ $(( $(date +%s) - started_at )) -ge "$timeout_seconds" ]; then
                log 'Daemon logs at timeout:'
                host_docker logs --tail 20 "$container_name" 2>&1 || true
                fail "Daemon did not become ready within ${timeout_seconds}s"
            fi

            sleep 3
        done
    }

    print_summary() {
        python3 - "$PORTS_JSON" "$INSTALL_ROOT" <<'PY'
import json
import sys

ports = json.loads(sys.argv[1])
install_root = sys.argv[2]
print('[install] Provisioning assets installed')
print(f'[install] Install root: {install_root}')
print(f"[install] MinIO port: {ports['minio']}")
print(f"[install] Redis port: {ports['redis']}")
print(f"[install] MongoDB port: {ports['mongodb']}")
PY
    }

    main() {
        require_argument "$TEAM_CLUSTER_ID" 'team-cluster-id'
        require_argument "$ENROLLMENT_TOKEN" 'enrollment-token'
        require_command curl

        trap cleanup EXIT
        trap on_error ERR

        detect_platform
        resolve_local_user
        ensure_supported_architecture
        set_install_root
        ensure_privileges

        log 'Checking Docker availability'
        ensure_runtime_capabilities
        ensure_python3

        VOLT_CLOUD_URL="${VOLT_CLOUD_URL:-${VOLT_CLOUD_SERVER_URL:-}}"
        if [ -z "$VOLT_CLOUD_URL" ]; then
            fail 'Set VOLT_CLOUD_URL or VOLT_CLOUD_SERVER_URL before running the installer'
        fi
        VOLT_CLOUD_URL="${VOLT_CLOUD_URL%/}"
        export VOLT_CLOUD_URL

        ensure_deploy_user
        choose_ports

        log 'Requesting daemon credentials from VoltCloud'
        send_healthcheck

        log 'Downloading install manifest'
        download_manifest

        log 'Materializing deployment files'
        materialize_manifest

        pull_runtime_images
        start_stack
        wait_for_daemon_ready
        print_summary
    }

    main "$@"
