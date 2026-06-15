---
name: _local-bdr-plan-001-roadmap-sprints
description: Plano de execução do SocialShelf organizado por sprints. Referência de estado atual de cada card e próximos marcos.
apply-to: Planejamento de produto e priorização de sprint
valid-from: 2026-06-15
---

# _local-bdr-plan-001: Roadmap de Sprints — SocialShelf · Rádio Kactus

## Contexto

Plano de execução por sprints do SocialShelf. Captura o estado atual de cada card e os marcos futuros. Atualizado via deliberação ARGUS quando o escopo de sprint muda.

## Estado Atual

### Sprint 0 — Fundação ✅ Completo

- Repositório GitHub + branch strategy
- Monorepo pnpm workspaces + Turborepo
- TypeScript base config (`packages/tsconfig`)
- Domain package — entidades + ports (arquitetura hexagonal)
- `api-service` scaffold (Fastify + Vitest)
- `publisher-service` scaffold (Fastify + Vitest)
- `generator-service` scaffold (Fastify + Vitest + Gemini/Vertex AI)
- Firebase config (`firestore.rules` + índices)
- CI/CD — GitHub Actions (lint + type-check + test + docker build)
- Dockerfiles para Cloud Run (api, publisher, generator)
- Setup Firebase — projeto GCP real (`socialshelf-547da`)
- Web scaffold (Next.js 15 + TailwindCSS)
- Secret Manager API habilitado + credenciais locais via gcloud ADC
- 📋 Cloud Run — deploy inicial dos 3 serviços (pendente)

### Sprint 1 — OAuth e Publicação (Em progresso)

- ✅ OAuth LinkedIn — end-to-end funcionando (`profile` + `w_member_social`)
- 🔄 OAuth X (Twitter) — código implementado, teste E2E pendente
- ⏸️ OAuth Instagram / Facebook (Meta) — aguardando deploy com HTTPS real
- ✅ Publicação manual — composer UI (+ Novo Post)
- 📋 Publicação real — testes E2E LinkedIn + X
- 📋 Auditoria de segurança OAuth

### Sprint 2a — Publicação Manual (Planejado)

- Composer de post — editor de conteúdo
- Preview por plataforma
- Publicação imediata

### Sprint 2b — Geração de Conteúdo via IA (Planejado)

- Cloud Storage buckets + IAM
- EXIF strip middleware + upload
- AI consent flow
- `GeminiAdapter` (copy generation, Vertex AI)
- `ImagenAdapter` (image generation, Vertex AI)
- `GenerateContentUseCase`
- Tela de briefing + tela de revisão

### Sprint 3 — Agendamento e Métricas (Planejado)

- Agendamento de posts (Cloud Tasks + Cloud Scheduler)
- Dashboard de métricas
- Monitoramento e alertas

### Sprint 4 — Multi-produto e Lançamento (Planejado)

- Multi-produto — seletor de marca
- Testes de usabilidade
- Preparação de lançamento
- Onboarding Rádio Kactus
- Plano de conteúdo — semana 1

## Próximas Decisões

Antes de iniciar Sprint 2b, a Galera de Segurança deve deliberar sobre o fluxo de AI consent — coleta de dados para geração de imagens impacta `_local-adr-policy-003-pairwise-identity-consent` e `_local-adr-policy-002-data-minimization`.

## References

- [_local-bdr-policy-001-plataforma-produto](../001-plataforma-produto.md) - Contexto de produto
- [_local-bdr-policy-002-redes-sociais-suportadas](../002-redes-sociais-suportadas.md) - Status por plataforma
