# Build context is the repo root: docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS base
RUN corepack enable pnpm
# lefthook's prepare hook needs git; LEFTHOOK=0 disables it inside the image.
ENV LEFTHOOK=0 CI=true
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/api/package.json packages/api/
COPY packages/db/package.json packages/db/
COPY packages/env/package.json packages/env/
COPY packages/config/package.json packages/config/
# Prisma postinstall needs the schema present before install.
COPY packages/db/prisma packages/db/prisma/
COPY packages/db/prisma.config.ts packages/db/
RUN pnpm install --frozen-lockfile --filter api...

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /repo /repo
COPY packages ./packages
COPY apps/api ./apps/api
WORKDIR /repo/apps/api
EXPOSE 3001
# Apply migrations, then start. Node 24 runs TypeScript natively.
CMD ["sh", "-c", "pnpm --filter @web-starter/db migrate && node src/index.ts"]
