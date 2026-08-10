FROM tailscale/tailscale:stable AS tailscale-bin

FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        nodejs \
        python3 \
        python3-pip \
        python3-venv \
        zstd \
        make \
        g++ \
        pkg-config \
        libcairo2-dev \
        libpango1.0-dev \
        libjpeg-dev \
        libgif-dev \
        librsvg2-dev \
        libhwloc15 \
        libhwloc-plugins \
        libtbb12 \
        libtbbmalloc2 \
        libgl1 \
        libglx-mesa0 \
        libegl-mesa0 \
        libegl1 \
        libglib2.0-0 \
        libopengl0 \
        libxkbcommon0 \
        libdbus-1-3 \
        libxcb-icccm4 \
        libxcb-image0 \
        libxcb-keysyms1 \
        libxcb-randr0 \
        libxcb-render-util0 \
        libxcb-shape0 \
        libxcb-xinerama0 \
        libxcb-xfixes0 \
        libxcb-cursor0 \
        libxcb-xkb1 \
        libxkbcommon-x11-0 \
        libxcb1 \
    && rm -rf /var/lib/apt/lists/*

# The daemon consumes @voltstack/daemon-cluster-client from the repository
# (file: link), so the SDK package must exist before `npm ci` can link it, and
# its dist must be built before the daemon's own build typechecks against it.
COPY cluster/package.json cluster/package-lock.json ./cluster/
COPY sdk/node/DaemonClusterClient/package.json ./sdk/node/DaemonClusterClient/
RUN cd cluster && npm ci

COPY sdk/node/DaemonClusterClient ./sdk/node/DaemonClusterClient
RUN cd sdk/node/DaemonClusterClient && npm install --no-audit --no-fund && npm run build

COPY cluster/tsconfig.json cluster/tsconfig.build.json ./cluster/
COPY cluster/src ./cluster/src
COPY cluster/scripts ./cluster/scripts
COPY --from=tailscale-bin /usr/local/bin/tailscale /usr/local/bin/tailscale

RUN cd cluster && npm run build && npm prune --omit=dev

ENV NODE_ENV=production

WORKDIR /app/cluster
CMD ["npm", "run", "start"]
