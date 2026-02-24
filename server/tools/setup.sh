#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${SERVER_DIR}/.." && pwd)"

NATIVE_DIR="${SERVER_DIR}/native"
DOCKER_SCRIPTING_DIR="${SERVER_DIR}/docker/scripting"
SCRIPTING_IMAGE_TAG="${SCRIPTING_IMAGE_TAG:-volt-scripting-env:latest}"

log() {
  printf '\n[%s] %s\n' "setup" "$1"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

run_npm_install() {
  local dir="$1"
  log "Running npm install in ${dir}"
  (
    cd "$dir"
    npm install
  )
}

build_scripting_image() {
  log "Building Docker image ${SCRIPTING_IMAGE_TAG} from ${DOCKER_SCRIPTING_DIR}"
  docker build \
    -t "${SCRIPTING_IMAGE_TAG}" \
    -f "${DOCKER_SCRIPTING_DIR}/Dockerfile" \
    "${DOCKER_SCRIPTING_DIR}"
}

main() {
  log "Workspace root: ${ROOT_DIR}"

  require_cmd npm
  require_cmd docker

  [[ -d "${NATIVE_DIR}" ]] || { echo "Directory not found: ${NATIVE_DIR}" >&2; exit 1; }
  [[ -d "${SERVER_DIR}" ]] || { echo "Directory not found: ${SERVER_DIR}" >&2; exit 1; }
  [[ -f "${DOCKER_SCRIPTING_DIR}/Dockerfile" ]] || { echo "Dockerfile not found: ${DOCKER_SCRIPTING_DIR}/Dockerfile" >&2; exit 1; }

  run_npm_install "${NATIVE_DIR}"
  run_npm_install "${SERVER_DIR}"
  build_scripting_image

  log "Done"
}

main "$@"
