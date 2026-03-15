#!/usr/bin/env bash

set -euo pipefail

readonly DBUS_RUN_DIRECTORY="/run/dbus"
readonly DBUS_SYSTEM_SOCKET="${DBUS_RUN_DIRECTORY}/system_bus_socket"
readonly DBUS_PID_FILE="${DBUS_RUN_DIRECTORY}/pid"
readonly UPSTREAM_ENTRYPOINT="/usr/local/bin/upstream-entrypoint"

start_system_dbus() {
    mkdir -p "${DBUS_RUN_DIRECTORY}"

    if command -v dbus-uuidgen >/dev/null 2>&1; then
        dbus-uuidgen --ensure=/etc/machine-id
    fi

    if [ -S "${DBUS_SYSTEM_SOCKET}" ]; then
        return
    fi

    if [ -f "${DBUS_PID_FILE}" ] && ! kill -0 "$(cat "${DBUS_PID_FILE}")" >/dev/null 2>&1; then
        rm -f "${DBUS_PID_FILE}"
    fi

    dbus-daemon --system --fork
}

start_system_dbus
exec "${UPSTREAM_ENTRYPOINT}" "$@"
