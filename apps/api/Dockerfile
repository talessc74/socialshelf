FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/domain/package.json ./packages/domain/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --filter @socialshelf/api...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY packages/tsconfig ./packages/tsconfig
COPY packages/domain ./packages/domain
COPY apps/api ./apps/api
RUN pnpm --filter @socialshelf/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 appuser
COPY --from=builder --chown=appuser:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/apps/api/node_modules ./node_modules
USER appuser
EXPOSE 3001
CMD ["node", "dist/index.js"]
