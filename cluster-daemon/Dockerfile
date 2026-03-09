FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY native/package.json ./native/package.json
COPY native/package-lock.json ./native/package-lock.json
COPY native ./native
RUN npm install
RUN npm --prefix native install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production

CMD ["npm", "run", "start"]
