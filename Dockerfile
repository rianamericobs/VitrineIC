FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 DATABASE_PATH=/data/vitrineic.sqlite PORT=3001
WORKDIR /app
RUN corepack enable && mkdir /data && chown node:node /data /app
COPY --from=build --chown=node:node /app/package.json /app/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/scripts/backup-database.mjs ./scripts/backup-database.mjs
USER node
VOLUME ["/data"]
EXPOSE 3001
CMD ["node", "build/server.mjs"]
