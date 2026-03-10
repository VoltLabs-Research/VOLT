FROM node:22
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
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
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY native/package.json ./native/package.json
COPY native ./native
RUN npm install
RUN npm --prefix native install

COPY tsconfig.json ./
COPY src ./src
COPY image-contexts ./image-contexts

RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production

CMD ["npm", "run", "start"]
