---
name: _local-edr-policy-002-docker-multistage
description: Define o padrão de Dockerfile multi-stage para os serviços do SocialShelf. Use ao criar ou modificar Dockerfiles de qualquer serviço.
apply-to: Dockerfiles de apps/api, apps/publisher, apps/generator, apps/web
valid-from: 2026-06-06
---

# _local-edr-policy-002: Docker Multi-Stage Non-Root

## Context and Problem Statement

Imagens Docker com todas as dependências de desenvolvimento, executadas como root, aumentam a superfície de ataque e o tamanho do container sem necessidade operacional.

Como construir imagens Docker mínimas, seguras e reprodutíveis para os serviços do SocialShelf?

## Decision Outcome

**Builds multi-stage com Alpine, dependências de produção apenas e usuário não-root**

Cada Dockerfile tem 4 stages: `base`, `deps`, `builder`, `runner`. A imagem final contém apenas o runtime necessário.

### Details

**Estrutura obrigatória de stages**

```dockerfile
# Stage 1: base — versão fixa de Node + pnpm
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Stage 2: deps — instala dependências com lockfile
FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml .
RUN pnpm install --frozen-lockfile --filter @socialshelf/[service]...

# Stage 3: builder — constrói domain + app
FROM deps AS builder
RUN pnpm --filter @socialshelf/domain build
RUN pnpm --filter @socialshelf/[service] build
RUN pnpm deploy --prod --filter @socialshelf/[service] /app/deploy

# Stage 4: runner — imagem final mínima
FROM node:20-alpine AS runner
RUN addgroup -S nodejs && adduser -S appuser -G nodejs
WORKDIR /app
COPY --from=builder /app/deploy .
USER appuser
EXPOSE [port]
CMD ["node", "dist/index.js"]
```

**Regras**

- Versão de Node fixada em `20-alpine` — sem `latest` ou tags flutuantes.
- `pnpm@9.15.0` fixado via `corepack prepare` — sem ambiguidade de versão.
- `--frozen-lockfile` obrigatório no stage `deps`.
- `pnpm deploy --prod` no stage `builder` — copia apenas dependências de produção para a imagem final.
- Usuário `appuser` (non-root) criado e usado no stage `runner` — nunca executar como `root`.
- Cada serviço expõe sua porta específica: api=3001, publisher=3002, generator=3003, web=3000.

**O que não é permitido**

- `USER root` no stage `runner`.
- Copiar `node_modules` de desenvolvimento para a imagem final.
- Tags flutuantes de imagem base (`:latest`, `:lts`, etc.).
- `RUN npm install` (usar apenas `pnpm`).

## References

- [_local-edr-policy-001-ci-pipeline](001-ci-pipeline.md) - Docker build check em CI
- [_local-edr-policy-001-cloud-run](../infra/001-cloud-run.md) - Imagem publicada no Artifact Registry
