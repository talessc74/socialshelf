---
name: _local-adr-policy-002-monorepo-pnpm-turbo
description: Define pnpm workspaces + Turborepo como estrutura de monorepo do SocialShelf. Use ao adicionar novos apps ou packages, configurar pipelines de build, ou gerenciar dependências compartilhadas.
apply-to: Estrutura de repositório e pipeline de build
valid-from: 2026-06-06
---

# _local-adr-policy-002: Monorepo pnpm + Turborepo

## Context and Problem Statement

O SocialShelf possui quatro aplicações (api, web, publisher, generator) e packages compartilhados (domain, tsconfig). Código duplicado, builds inconsistentes e dependências desalinhadas são riscos reais em ambientes multi-serviço.

Como organizar múltiplos serviços e packages compartilhados garantindo consistência, builds rápidos e dependências controladas?

## Decision Outcome

**pnpm workspaces para gestão de dependências + Turborepo para orquestração de build**

pnpm garante deduplificação de dependências e lockfile determinístico. Turborepo orquestra builds na ordem correta com cache distribuído.

### Details

**Estrutura**

```
pnpm-workspace.yaml       ← declara apps/* e packages/*
turbo.json                ← define tasks e dependências
packages/
  domain/                 ← zero dependências externas; construído primeiro
  tsconfig/               ← configs TypeScript compartilhadas; sem build step
apps/
  api/ publisher/ generator/ web/
```

**Regras de build (turbo.json)**

- `"dependsOn": ["^build"]` — dependências transitivas constroem antes do serviço.
- O domain sempre constrói antes de qualquer app; apps nunca constroem em paralelo com suas dependências.
- `dev` e `test` são sempre executados com cache desabilitado (`"cache": false` para dev, outputs rastreados para test).

**Dependências**

- `pnpm install --frozen-lockfile` obrigatório em CI — garante reprodutibilidade.
- Packages do workspace são referenciados como `workspace:*` no `package.json` de cada app.
- Adicionar nova dependência a um app específico: `pnpm add <dep> --filter @socialshelf/<app>`.
- Adicionar dependência ao workspace root apenas quando necessária em todos os packages.

**TypeScript compartilhado**
`packages/tsconfig` exporta `base.json`, `node.json` e `nextjs.json`. Todos os apps estendem a config mais adequada, garantindo `strict: true`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes` em todo o monorepo.

## References

- [_local-edr-policy-002-typescript-strict](../../edrs/principles/002-typescript-strict.md) - Flags TypeScript obrigatórias
- [_local-edr-policy-001-ci-pipeline](../../edrs/devops/001-ci-pipeline.md) - Como o CI usa pnpm + turbo
