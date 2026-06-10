FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/domain/package.json ./packages/domain/
COPY apps/publisher/package.json ./apps/publisher/
RUN pnpm install --frozen-lockfile --filter @socialshelf/publisher...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/publisher/node_modules ./apps/publisher/node_modules
COPY packages/tsconfig ./packages/tsconfig
COPY packages/domain ./packages/domain
COPY apps/publisher ./apps/publisher
RUN pnpm --filter @socialshelf/domain build
RUN pnpm --filter @socialshelf/publisher build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 appuser
COPY --from=builder --chown=appuser:nodejs /app/apps/publisher/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/apps/publisher/node_modules ./node_modules
USER appuser
EXPOSE 3002
CMD ["node", "dist/index.js"]
