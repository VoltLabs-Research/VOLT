FROM tailscale/tailscale:stable AS tailscale-bin

FROM ubuntu:24.04 AS system
ENV DEBIAN_FRONTEND=noninteractive

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

# Build context is the workspace root. The daemon links @voltstack/daemon-cluster-client
# from the workspace, so the SDK's manifest must be present for the install and its dist
# built before the daemon runs or builds against it.
FROM system AS source
RUN npm install -g pnpm@10
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/infra/cluster/package.json packages/infra/cluster/
COPY packages/sdk/daemon-cluster-client/package.json packages/sdk/daemon-cluster-client/
RUN pnpm install --frozen-lockfile --filter cluster-daemon...

COPY packages/sdk/daemon-cluster-client packages/sdk/daemon-cluster-client
RUN pnpm --filter @voltstack/daemon-cluster-client build

COPY packages/infra/cluster packages/infra/cluster
WORKDIR /app/packages/infra/cluster

# The desktop app's single-machine stack runs the daemon from source.
FROM source AS dev
RUN pnpm run fetch:tools
CMD ["pnpm", "run", "dev"]

# `pnpm deploy` copies the daemon and its production dependencies into a self-contained
# directory, with the SDK copied in instead of linked to the workspace. vendor/ is copied
# on its own because deploy drops the shared-library symlinks it contains.
FROM source AS build
RUN pnpm run build && pnpm --filter cluster-daemon --prod deploy --legacy /deploy

FROM system
COPY --from=tailscale-bin /usr/local/bin/tailscale /usr/local/bin/tailscale
COPY --from=build /deploy /app
COPY --from=build /app/packages/infra/cluster/vendor /app/vendor

ENV NODE_ENV=production

WORKDIR /app
CMD ["npm", "run", "start"]
