FROM node:22

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ libfmt9 libhwloc15 libhwloc-plugins libspdlog1.10 libtbb12 libtbbmalloc2 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY native/package.json ./native/package.json
COPY native ./native
RUN npm install
RUN npm --prefix native in  stall

COPY tsconfig.json ./
COPY src ./src
COPY docker ./docker

RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production

CMD ["npm", "run", "start"]
