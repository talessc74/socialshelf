---
name: _local-edr-policy-046-historico-do-tick-de-autonomia
description: Cada tentativa do tick de autonomia (publicado, pulado e por quê, erro) passa a ser gravada em Firestore e fica consultável via GET /autonomy-tick-log, exibida em /dashboard/brand. Use ao investigar por que o modo automático/semi-automático não gerou ou publicou nada, ou ao mexer no AutonomyTickUseCase.
apply-to: packages/domain — AutonomyTickLogEntry, AutonomyTickLogRepository; apps/publisher — AutonomyTickUseCase, FirestoreAutonomyTickLogRepository; apps/api — rota autonomy-tick-log; apps/web — AutonomyTickHistory, /dashboard/brand
valid-from: 2026-07-11
---

# _local-edr-policy-046: Histórico do Tick de Autonomia

## Context and Problem Statement

Usuário com o modo automático configurado há ~24h e nenhum post publicado pediu pra eu verificar o que estava acontecendo. Conferi a configuração da marca (tópicos liberados, nível de autonomia, teto diário) e estava tudo correto — mas não havia nenhum jeito de eu (ou o usuário) ver o que o tick realmente decidiu em cada tentativa. `AutonomyTickUseCase.execute()` sempre devolveu um array de resultados por marca (`{action, topicHeadline?, error?}`), mas esse array só existia por um instante na resposta HTTP que o Cloud Scheduler recebe e descarta — nem persistido em nenhum lugar, nem exposto em nenhuma tela. Diagnosticar exigia adivinhar a partir da configuração, sem confirmação real.

## Decision Outcome

**Cada resultado por marca que `AutonomyTickUseCase.execute()` já calculava passa a ser gravado como `AutonomyTickLogEntry` numa subcoleção Firestore, lido por uma rota nova em `apps/api` e exibido como uma lista compacta em `/dashboard/brand`.**

### Details

**`AutonomyTickAction` promovido de `apps/publisher` para `packages/domain`**

A union de ações (`skipped-no-platforms`, `skipped-not-yet-time`, `skipped-no-suggestions`, `skipped-blocked`, `skipped-not-eligible`, `skipped-daily-limit`, `draft-created`, `published`, `error`) vivia só em `AutonomyTickUseCase.ts`. Agora que `apps/api` também precisa do mesmo vocabulário pra tipar o que lê do Firestore, ela vira `packages/domain/src/entities/AutonomyTickLogEntry.ts` — mesmo raciocínio já aplicado a `computeDailySlotHours` (_local-edr-policy-038, adendo anterior): regra/vocabulário usado por mais de um serviço sobe pro pacote compartilhado em vez de duplicar.

**Subcoleção direta por marca, não `collectionGroup`**

`users/{userId}/brands/{brandId}/autonomy_tick_log/{entryId}`, um documento por tentativa, `orderBy('createdAt', 'desc')` sem nenhum índice composto novo — é uma consulta numa subcoleção referenciada diretamente (`db.collection(...).doc(...).collection(...)`), não uma `collectionGroup()`, então não cai na mesma classe de bug de índice que motivou toda a saga de `CampaignPhoto`/`CampaignItem` (_local-edr-policy-039/042). Datas gravadas como string ISO (`toISOString()`/`new Date(...)`), mesmo padrão já usado em `FirestorePostRepository` — não `Timestamp` nativo do Firestore.

**Grava mesmo quando a marca falha antes de qualquer resultado normal**

`execute()` já envolvia `processBrand` num try/catch por marca (isolamento de falha, existente desde a implementação original). A gravação do log entra logo depois — tanto no caminho de sucesso quanto no catch —, então um erro de infraestrutura (Firestore indisponível, generator-service fora do ar) também vira uma entrada `action: 'error'` visível, não só os `skipped-*`/`published`/`draft-created` do caminho feliz.

**Falha ao gravar o log não derruba o tick**

`tickLog.save(...)` fica dentro do próprio try/catch da gravação (silenciosamente ignorado em caso de erro) — é observabilidade, não a função principal; se o Firestore estiver com problema bem na escrita do log, isso não pode impedir o resultado real (publicar/pular) de ser devolvido e a próxima marca de ser processada.

**`GET /autonomy-tick-log` em apps/api, não em apps/publisher**

Mesmo padrão arquitetural já estabelecido no projeto: apps/publisher e apps/generator só respondem a chamadas internas (`X-Internal-Secret`), nunca diretamente ao navegador do usuário; apps/api é o único gateway autenticado por usuário. A rota nova lê a mesma coleção que `apps/publisher` grava, direto via `FirestoreAutonomyTickLogRepository` duplicado em `apps/api` (mesmo padrão já usado por `FirestorePostRepository`, `FirestoreOAuthRepository` etc., triplicados entre os três serviços) — sem proxy HTTP entre serviços pra uma simples leitura.

**Exibido em `/dashboard/brand`, escondido no modo manual**

`AutonomyTickHistory` (novo componente) aparece dentro da seção "Operação" só quando `autonomyLevel !== 'manual'` — mesma regra que `AutonomyBrandDiscoveryPort.findEligibleBrands()` já usa pra nunca incluir marcas manuais no tick; mostrar um histórico vazio de algo que nunca roda seria confuso. Cada entrada mostra um rótulo específico por ação (ex: "Pulado — a pauta está fora dos tópicos liberados para automático"), a manchete da pauta avaliada quando houver, a mensagem de erro quando `action: 'error'`, e o horário em `pt-BR`.

## What this does not solve

Histórico começa a existir só a partir deste deploy — tentativas anteriores (incluindo as que motivaram esta investigação) não foram gravadas, porque a persistência não existia ainda. Sem paginação (só os 20 mais recentes por marca); sem filtro por tipo de ação; sem nenhum canal proativo (e-mail/push) quando uma marca acumula vários `skipped-*`/`error` seguidos — o usuário ainda precisa abrir `/dashboard/brand` pra ver.

## References

- [_local-edr-policy-038-tick-diario-de-autonomia-implementacao](038-tick-autonomia-implementacao.md) - AutonomyTickUseCase original e o adendo do tick de hora em hora que motivou a pergunta do usuário sobre múltiplos posts/dia
- [_local-edr-policy-042-campanha-revisao-pos-saga-do-indice](042-campanha-revisao-pos-saga-do-indice.md) - Origem do cuidado com collectionGroup vs. subcoleção direta na hora de escolher como consultar o Firestore
