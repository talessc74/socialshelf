FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN apk add --no-cache vips-dev

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/domain/package.json ./packages/domain/
COPY apps/generator/package.json ./apps/generator/
RUN pnpm install --frozen-lockfile --filter @socialshelf/generator...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/generator/node_modules ./apps/generator/node_modules
COPY packages/tsconfig ./packages/tsconfig
COPY packages/domain ./packages/domain
COPY apps/generator ./apps/generator
RUN pnpm --filter @socialshelf/domain build
RUN pnpm --filter @socialshelf/generator build
RUN pnpm deploy --filter @socialshelf/generator --prod /deploy

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache vips
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 appuser
COPY --from=builder --chown=appuser:nodejs /deploy ./
USER appuser
EXPOSE 3003
CMD ["node", "dist/index.js"]
