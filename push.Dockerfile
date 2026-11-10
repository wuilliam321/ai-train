FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=train-app-pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

COPY tsconfig.server.json ./
COPY server ./server
RUN pnpm server:build

FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS production-dependencies
WORKDIR /production
COPY package.json ./
RUN node -e "const fs=require('node:fs');const manifest=JSON.parse(fs.readFileSync('package.json','utf8'));fs.writeFileSync('package.json',JSON.stringify({private:true,dependencies:{'web-push':manifest.dependencies['web-push']}}));" && npm install --omit=dev --ignore-scripts --no-audit

FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS production
WORKDIR /app
RUN apk upgrade --no-cache && npm install -g npm@11.21.2 && mkdir /data && chown node:node /data
COPY package.json pnpm-lock.yaml ./
COPY --from=production-dependencies /production/node_modules ./node_modules
COPY --from=build /app/server-dist ./server-dist
USER node
EXPOSE 3000
CMD ["node", "server-dist/index.js"]
