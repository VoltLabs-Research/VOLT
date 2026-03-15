#!/bin/sh

set -eu

if [ -r /etc/profile ]; then
    . /etc/profile
fi

if [ -r "$HOME/.profile" ]; then
    . "$HOME/.profile"
fi

export DESKTOP_SESSION=xfce
export XDG_CURRENT_DESKTOP=XFCE
export XDG_SESSION_DESKTOP=xfce
export XDG_SESSION_TYPE=x11

if command -v dbus-launch >/dev/null 2>&1; then
    exec dbus-launch --exit-with-session xfce4-session
fi

exec xfce4-session
