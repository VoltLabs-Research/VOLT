FROM accetto/ubuntu-vnc-xfce-g3:24.04

ARG TARGETARCH

ENV DEBIAN_FRONTEND=noninteractive

USER root

COPY --chmod=755 entrypoint.sh /usr/local/bin/voltlabs-entrypoint
COPY --chmod=755 startwm.sh /tmp/voltlabs-startwm.sh
COPY --chmod=755 xsession /tmp/voltlabs-xsession

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        dbus-x11 \
        fonts-dejavu-core \
        fonts-liberation \
        fonts-noto-color-emoji \
        fonts-noto-core \
        gnupg \
        gvfs \
        gvfs-backends \
        gvfs-fuse \
        less \
        mousepad \
        nano \
        procps \
        psmisc \
        thunar \
        unzip \
        vim-tiny \
        wget \
        xdg-utils \
        zip \
    && install -d -m 0755 /etc/apt/keyrings \
    && if [ "${TARGETARCH}" = 'amd64' ]; then \
        curl -fsSL 'https://dl.google.com/linux/linux_signing_key.pub' \
            | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg \
        && chmod a+r /etc/apt/keyrings/google-chrome.gpg \
        && printf '%s\n' 'deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main' > /etc/apt/sources.list.d/google-chrome.list \
        && apt-get update \
        && apt-get install -y --no-install-recommends google-chrome-stable; \
    else \
        printf 'Skipping Google Chrome installation for unsupported architecture: %s\n' "${TARGETARCH}" >&2; \
    fi \
    && install -d -m 0700 /etc/skel/.vnc \
    && install -m 0755 /tmp/voltlabs-startwm.sh /etc/skel/.vnc/startwm.sh \
    && install -m 0755 /tmp/voltlabs-xsession /etc/skel/.xsession \
    && if id -u headless >/dev/null 2>&1; then \
        install -d -m 0700 /home/headless/.vnc \
        && install -m 0755 /etc/skel/.vnc/startwm.sh /home/headless/.vnc/startwm.sh \
        && install -m 0755 /etc/skel/.xsession /home/headless/.xsession \
        && chown -R headless:headless /home/headless/.vnc /home/headless/.xsession; \
    fi \
    && rm -rf /var/lib/apt/lists/* /etc/apt/sources.list.d/google-chrome.list /tmp/voltlabs-startwm.sh /tmp/voltlabs-xsession

USER headless

ENTRYPOINT ["/usr/local/bin/voltlabs-entrypoint"]
