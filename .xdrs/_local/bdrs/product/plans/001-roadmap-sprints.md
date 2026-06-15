# _local-bdr-plan-001: Roadmap de Sprints — SocialShelf · Rádio Kactus

## Executive Summary

- Sprint 0 concluído: monorepo, domain hexagonal, 3 serviços Fastify, CI/CD, Firebase, Dockerfiles.
- Sprint 1 em progresso: OAuth LinkedIn funcionando, OAuth X e Meta implementados (X bloqueado por custo de API do plano pago, Meta ativo na UI), composer de posts entregue.
- Pendente em Sprint 1: testes E2E e auditoria de segurança OAuth.
- Sprints 2a–4 planejados: publicação manual, geração via IA, agendamento, métricas e lançamento com Rádio Kactus.
- Data prevista de encerramento do plano: 2026-12-31.

## Context and Problem Statement

O SocialShelf é um SaaS de publicação social para pequenos criadores. O objetivo é entregar ao Rádio Kactus — primeiro cliente — uma plataforma funcional para publicar conteúdo em múltiplas redes sociais a partir de uma interface única.

A execução está organizada em sprints incrementais. Cada sprint entrega valor funcional verificável antes de avançar. Este plano rastreia o estado atual de entrega e os próximos marcos.

## Proposed Solution

Entregar o produto em cinco sprints (0–4), do scaffolding inicial ao lançamento com o Rádio Kactus, com suporte a publicação em LinkedIn, X, Instagram e Facebook, geração de conteúdo via IA e agendamento de posts.

Expected end date: 2026-12-31

## Approach

Desenvolvimento incremental com deliberações ARGUS antes de mudanças de escopo ou decisões arquiteturais significativas. Cada sprint tem entregáveis verificáveis. Políticas de segurança e privacidade são avaliadas antes de iniciar funcionalidades que envolvam novos dados do usuário (especialmente Sprint 2b — AI consent flow).

## Milestones

### Milestone 0: Fundação
Due date: 2026-05-01

Entregue. Monorepo pnpm + Turborepo, domain package hexagonal, 3 serviços Fastify scaffoldados, Firebase config, CI/CD GitHub Actions, Dockerfiles Cloud Run, web scaffold Next.js 15.

**Acceptance checklist:**
- [x] Domain package com entidades e ports
- [x] CI passando (lint, type-check, test, docker build)
- [x] Firebase configurado com projeto GCP real

---

### Milestone 1: OAuth e Publicação Inicial
Due date: 2026-06-30

Em progresso.

**Acceptance checklist:**
- [x] OAuth LinkedIn end-to-end funcionando
- [x] OAuth X implementado (bloqueado por plano de API pago — aguarda decisao comercial)
- [x] OAuth Meta implementado (Instagram + Facebook ativos na UI)
- [x] Composer de posts entregue
- [ ] Testes E2E LinkedIn e X
- [ ] Auditoria de segurança OAuth

**Riscos:**
- X API requer plano pago — Mitigação: manter desabilitado na UI até decisao de custo.
- Meta requer HTTPS real para OAuth — Mitigação: dependente do deploy em producao.

---

### Milestone 2a: Publicação Manual
Due date: 2026-08-31

Planejado.

**Key tasks:**
- Composer de post — editor de conteúdo completo
- Preview por plataforma com limites de caractere
- Publicação imediata com feedback de resultado

---

### Milestone 2b: Geração de Conteúdo via IA
Due date: 2026-09-30

Planejado. Requer deliberação da Galera de Segurança antes de iniciar — AI consent flow impacta `_local-adr-policy-007-identidade-pairwise-e-consentimento` e `_local-adr-policy-006-dados-como-passivo-minimizacao`.

**Key tasks:**
- Cloud Storage buckets + IAM
- EXIF strip middleware + upload
- AI consent flow
- GeminiAdapter (copy generation, Vertex AI)
- ImagenAdapter (image generation, Vertex AI)
- GenerateContentUseCase
- Tela de briefing + tela de revisao

---

### Milestone 3: Agendamento e Metricas
Due date: 2026-10-31

Planejado.

**Key tasks:**
- Agendamento de posts (Cloud Tasks + Cloud Scheduler)
- Dashboard de metricas
- Monitoramento e alertas

---

### Milestone 4: Multi-produto e Lancamento
Due date: 2026-12-31

Planejado.

**Key tasks:**
- Multi-produto — seletor de marca
- Testes de usabilidade
- Onboarding Rádio Kactus
- Plano de conteúdo — semana 1

## References

- [_local-bdr-policy-002-socialshelf-plataforma-e-produto](../002-plataforma-produto.md) - Contexto de produto
- [_local-bdr-policy-003-redes-sociais-suportadas](../003-redes-sociais-suportadas.md) - Status por plataforma
