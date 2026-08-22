FROM node:24-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=train-app-pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

COPY tsconfig.server.json ./
COPY server ./server
RUN pnpm server:build

FROM node:24-alpine AS production

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=train-app-pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --prod --frozen-lockfile && \
    mkdir /data && chown node:node /data

COPY --from=build /app/server-dist ./server-dist

USER node
EXPOSE 3000
CMD ["node", "server-dist/index.js"]
