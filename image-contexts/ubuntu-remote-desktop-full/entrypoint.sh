#!/usr/bin/env bash

set -euo pipefail

readonly CONTAINER_USERNAME_ENV_KEY="CONTAINER_USERNAME"
readonly DEFAULT_CONTAINER_USER="headless"
readonly DBUS_RUN_DIRECTORY="/run/dbus"
readonly DBUS_SYSTEM_SOCKET="${DBUS_RUN_DIRECTORY}/system_bus_socket"
readonly DBUS_PID_FILE="${DBUS_RUN_DIRECTORY}/pid"
readonly UPSTREAM_ENTRYPOINT="/usr/local/bin/upstream-entrypoint"
readonly VNC_PASSWORD_ENV_KEY="VNC_PW"

log_info() {
    printf '[volt-ubuntu-remote-desktop-full] %s\n' "$1"
}

log_warn() {
    printf '[volt-ubuntu-remote-desktop-full] %s\n' "$1" >&2
}

resolve_container_username() {
    local requested_username="${CONTAINER_USERNAME:-}"
    if [ -z "${requested_username}" ]; then
        printf '%s\n' "${DEFAULT_CONTAINER_USER}"
        return
    fi

    local normalized_username="${requested_username,,}"
    if [ "${normalized_username}" = 'root' ]; then
        log_warn "Ignoring ${CONTAINER_USERNAME_ENV_KEY}=root and falling back to ${DEFAULT_CONTAINER_USER}."
        printf '%s\n' "${DEFAULT_CONTAINER_USER}"
        return
    fi

    if [[ "${normalized_username}" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]]; then
        if [ "${normalized_username}" != "${requested_username}" ]; then
            log_info "Normalized ${CONTAINER_USERNAME_ENV_KEY} to lowercase: ${normalized_username}"
        fi

        printf '%s\n' "${normalized_username}"
        return
    fi

    log_warn "Invalid ${CONTAINER_USERNAME_ENV_KEY}='${requested_username}'. Falling back to ${DEFAULT_CONTAINER_USER}."
    printf '%s\n' "${DEFAULT_CONTAINER_USER}"
}

ensure_container_primary_group() {
    local container_username="$1"
    if getent group "${container_username}" >/dev/null 2>&1; then
        return
    fi

    groupadd "${container_username}"
}

ensure_user_home_directory() {
    local container_username="$1"
    local user_home_directory
    local primary_group_name
    user_home_directory="$(getent passwd "${container_username}" | cut -d: -f6)"
    if [ -z "${user_home_directory}" ]; then
        return
    fi

    primary_group_name="$(id -gn "${container_username}")"

    mkdir -p "${user_home_directory}"
    chown "${container_username}:${primary_group_name}" "${user_home_directory}"
}

set_linux_user_password() {
    local container_username="$1"
    local shared_password="${VNC_PW:-}"
    if [ -z "${shared_password}" ]; then
        log_warn "${VNC_PASSWORD_ENV_KEY} is not set. Linux user password will not be changed."
        return
    fi

    printf '%s:%s\n' "${container_username}" "${shared_password}" | chpasswd
}

ensure_container_linux_user() {
    local container_username="$1"

    if id -u "${container_username}" >/dev/null 2>&1; then
        log_info "Using existing Linux user '${container_username}'."
    else
        log_info "Creating Linux user '${container_username}'."
        ensure_container_primary_group "${container_username}"
        useradd --create-home --gid "${container_username}" --shell /bin/bash "${container_username}"

        if getent group sudo >/dev/null 2>&1; then
            usermod -aG sudo "${container_username}"
        fi
    fi

    ensure_user_home_directory "${container_username}"
    set_linux_user_password "${container_username}"
}

sync_remote_desktop_user_password() {
    local container_username="$1"
    if [ "${container_username}" = "${DEFAULT_CONTAINER_USER}" ]; then
        return
    fi

    if id -u "${DEFAULT_CONTAINER_USER}" >/dev/null 2>&1; then
        log_info "Syncing password for the existing desktop user '${DEFAULT_CONTAINER_USER}'."
        set_linux_user_password "${DEFAULT_CONTAINER_USER}"
    fi
}

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

container_username="$(resolve_container_username)"
ensure_container_linux_user "${container_username}"
sync_remote_desktop_user_password "${container_username}"

start_system_dbus
exec "${UPSTREAM_ENTRYPOINT}" "$@"
