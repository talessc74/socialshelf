---
name: _local-edr-policy-064-normalizacao-do-brandprofile-operation
description: FirestoreBrandProfileRepository (api e generator) normaliza operation.maxAutoPostsPerDay e operation.stylePreferences na leitura, com defaults tolerantes para perfis salvos antes desses campos existirem. Use ao investigar "Invalid request body" ao salvar marca ou qualquer leitura de BrandProfile.operation.
apply-to: apps/api e apps/generator — FirestoreBrandProfileRepository
valid-from: 2026-07-22
---

# _local-edr-policy-064: Normalização do BrandProfile.operation

## Context and Problem Statement

Usuário reportou `Invalid request body` ao clicar em "Salvar marca" numa marca antiga. `FirestoreBrandProfileRepository.fromFirestore` fazia cast raw de `operation` sem tolerância a campos ausentes. Perfis salvos antes de `maxAutoPostsPerDay` (`_local-edr-policy-038`) e `stylePreferences` (PR #148) existirem voltam do Firestore com esses campos `undefined`; ao reenviar o formulário, `JSON.stringify` remove a chave `undefined`, e o zod do `PUT /brand-profile` rejeita como campo obrigatório ausente — sem indicar a causa (a mensagem de erro no frontend também descartava os detalhes do zod). Como tornar a leitura de `BrandProfile.operation` tolerante a documentos antigos, sem migração de dado?

## Decision Outcome

**`normalizeBrandProfileOperation` (função pura, duplicada em `apps/api` e `apps/generator` — mesmo padrão de infraestrutura por serviço já usado em `FirestorePostRepository`) normaliza `operation` na leitura do Firestore, com defaults determinísticos por campo ausente ou fora de faixa.**

### Details

**Defaults por campo**

- `maxAutoPostsPerDay`: ausente ou não-numérico → `1` (mesmo mínimo seguro documentado em `_local-edr-policy-038`); fora da faixa 1–10 → clampado, nunca rejeitado.
- `stylePreferences`: ausente ou não é uma permutação completa dos 4 `TemplateStyle` → `ALL_TEMPLATE_STYLES`, mesmo fallback já usado em `apps/publisher/FirestoreAutonomyBrandDiscovery` e no formulário da marca (`apps/web`).
- `autonomyLevel`: ausente → `'manual'`. `autoPublishTopics`/`blockedTopics`: ausente → `[]`.

**Aplicado só na leitura, nunca reescreve o documento**

Não é uma migração — o Firestore continua sem esses campos até o usuário salvar a marca de novo (o que agora funciona, fechando o ciclo). Sem isso, qualquer leitura futura do mesmo documento continuaria falhando.

**Observabilidade melhorada no mesmo commit**

`apiFetch` (`apps/web/src/lib/api.ts`) passou a incluir `details.fieldErrors` do zod na mensagem de erro lançada, em vez de só o texto genérico `Invalid request body` — evita que o próximo problema de validação fique sem diagnóstico.

## What this does not solve

Não migra os documentos antigos no Firestore — eles seguem sem os campos até serem resalvos. Não normaliza os campos em toda leitura de `BrandProfile` do sistema — apenas nos dois `FirestoreBrandProfileRepository` (api, generator); `apps/publisher/FirestoreAutonomyBrandDiscovery` já tinha seu próprio fallback para `stylePreferences`, mas não para `maxAutoPostsPerDay`, que segue sem normalização própria ali por ora.

## References

- [_local-edr-policy-038-tick-de-autonomia-implementacao](038-tick-autonomia-implementacao.md) - Origem do campo maxAutoPostsPerDay e seu valor mínimo seguro
- [_local-adr-policy-025-brandprofile-schema-e-versionamento](../../adrs/application/025-brand-profile-schema-versionamento.md) - Schema versionado e imutável que esta normalização de leitura respeita
