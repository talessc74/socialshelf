---
name: _local-edr-policy-059-pausar-retomar-e-cancelar-campanha-ativa
description: Uma PhotoCampaign 'active' não podia ser parada por nenhum caminho — CancelCampaignUseCase só aceitava draft/reviewing, e não existia pausa. Campanha ganha o status 'paused'; PauseCampaignUseCase apaga os Posts ainda 'scheduled' (o publisher só olha Post.status, não a campanha) e devolve os CampaignItems a 'planned'; ResumeCampaignUseCase rematerializa esses itens com scheduledAt recalculado a partir de agora; CancelCampaignUseCase passa a aceitar qualquer status não-terminal, cascateando a mesma limpeza. Use ao mexer em qualquer PhotoCampaignStatus ou nos use cases de campanha em apps/api/src/use-cases/campaigns.
apply-to: apps/api — use-cases/campaigns (Pause/Resume/CancelCampaignUseCase), packages/domain — PhotoCampaign
valid-from: 2026-07-21
---

# _local-edr-policy-059: Pausar, retomar e cancelar campanha ativa

## Context and Problem Statement

Usuário pediu uma forma de parar uma campanha de fotos que já está `active` (publicando de
verdade). Levantamento do estado existente:

- `CancelCampaignUseCase` só aceitava `draft` e `reviewing` — `active`/`completed`/`cancelled`
  sempre rejeitavam com "Only a campaign that has not started can be cancelled".
- Nenhuma das três telas (`campaigns/page.tsx`, `[id]/upload/page.tsx`, `[id]/timeline/page.tsx`)
  mostrava o botão de cancelar fora de draft/reviewing.
- Uma campanha `active` já tem Posts reais materializados (`ActivateCampaignUseCase` /
  `materializeCampaignItems`) com `status: 'scheduled'` e `scheduledAt` fixo. O
  `ScheduledPostsPoller` do publisher escaneia **todos** os Posts agendados via
  `findScheduledBefore(cutoff)` sem olhar campanha nenhuma — só tirar o Post do status
  `'scheduled'` impede a publicação; mudar `PhotoCampaign.status` sozinho não faz nada.

Pedido do usuário, refinado por pergunta direta (ver AskUserQuestion): pausar precisa permitir
retomar depois, com a linha do tempo restante reagendada pra datas novas (não retomar de onde
parou); cancelar precisa funcionar a qualquer momento.

## Decision Outcome

**Novo status `'paused'` em `PhotoCampaignStatus`. `PauseCampaignUseCase` (active → paused) apaga
os Posts ainda `'scheduled'` da campanha e devolve os `CampaignItem`s correspondentes a `'planned'`
(postId null). `ResumeCampaignUseCase` (paused → active) rematerializa esses itens com
`scheduledAt` recalculado a partir de `new Date()` via `computeScheduledTimes` (mesma função de
Generate/ExtendCampaignTimelineUseCase). `CancelCampaignUseCase` passa a aceitar qualquer status
que não seja `completed`/`cancelled`, cascateando a mesma limpeza quando `active`/`paused`.**

### Details

**Um helper compartilhado, não lógica duplicada em Pause e Cancel**

`cancelPendingCampaignPosts(items, itemRepo, postRepo)` é a única lógica que decide o que desfazer:
para cada `CampaignItem` `'materialized'` com `postId`, busca o Post — se `status !== 'scheduled'`
(já `published`, `publishing` ou `failed`), pula e preserva como histórico; se ainda `'scheduled'`,
apaga o Post e reverte o item pra `'planned'`/`postId: null`. Pause e Cancel chamam exatamente essa
função; a única diferença entre os dois use cases é o status final da campanha (`paused` vs
`cancelled`) e, no Cancel, que `draft`/`reviewing` pulam a cascata inteira (nunca materializaram
Post nenhum).

**Por que apagar o Post em vez de só marcar a campanha**

Coberto acima — é a única forma de o `ScheduledPostsPoller` parar de ver aquele Post como
publicável. Recriar um Post novo mais tarde (no Resume) é mais barato e mais claro que inventar um
status `'paused'` pra `Post` só pra esse caso — `PostStatus` continua com as mesmas seis variantes.

**Resume reagenda a partir de agora, não de onde parou**

Pedido explícito do usuário. `ResumeCampaignUseCase` ordena os itens `'planned'` por `order`,
chama `computeScheduledTimes(pending.length, campaign.postsPerDay, new Date())` e materializa via
`materializeCampaignItems` (mesma função de Activate/Extend) — o tempo que a campanha ficou
pausada nunca vira um acúmulo de posts atrasados dsparando todos de uma vez.

**Cancel a qualquer momento não-terminal**

`CancelCampaignUseCase` agora só rejeita `completed`/`cancelled` ("A campaign that already
finished cannot be cancelled"). `active` e `paused` cascateiam a limpeza antes de marcar
`cancelled`; `draft`/`reviewing` continuam sem tocar em Post nenhum (nunca existiu).

**UI: Pausar/Retomar/Cancelar nas três telas de campanha**

`campaigns/page.tsx`, `[id]/timeline/page.tsx` e `[id]/upload/page.tsx` ganham os três botões
condicionados ao status (`Pausar` só em `active`, `Retomar` só em `paused`, `Cancelar` em qualquer
status não-terminal). O `confirm()` de cancelamento de uma campanha `active`/`paused` avisa
explicitamente que posts ainda não publicados serão apagados — os já publicados continuam no
histórico.

## Addendum (2026-07-21)

Achado real em produção logo após o deploy: pausar e cancelar uma campanha `active` falhavam com
`9 FAILED_PRECONDITION: The query requires a COLLECTION_GROUP_ASC index for collection posts and
field id`. `cancelPendingCampaignPosts` buscava o Post com `postRepo.findById(item.postId)`, que
no `apps/api` faz `db.collectionGroup('posts').where('id', '==', id)` — uma query que exige um
índice composto nunca provisionado, porque nenhum outro caminho de `apps/api` chamava `findById`
em produção antes deste EDR. Trocado por `postRepo.findByIdAndBrand(item.postId, item.userId,
item.brandId)`, que já tínhamos os três valores disponíveis no próprio `CampaignItem` — lê o doc
direto pelo caminho `users/{uid}/brands/{bid}/posts/{id}`, sem collectionGroup e sem índice
nenhum.

## What this does not solve

Não adiciona um `'paused'` a `PostStatus` nem tenta pausar um Post individual fora de uma
campanha — pausa é uma operação de campanha inteira. Não preserva os horários antigos em lugar
nenhum: uma vez pausado, o plano anterior é definitivamente substituído no Resume, não há como
"continuar de onde parou" por design (pedido explícito do usuário). Não muda
`ExtendCampaignTimelineUseCase`, que continua rejeitando campanhas `paused` (só `reviewing` e
`active`) — agendar fotos novas numa campanha pausada primeiro precisa de Resume.

## References

- [_local-adr-policy-041-campanha-de-fotos-espinha-dorsal-fase-1](../../adrs/application/041-campanha-de-fotos-espinha-dorsal.md) - Arquitetura original de CampaignItem → Post via materializeCampaignItems
- [_local-edr-policy-054-falhas-de-publicacao-visiveis](054-falhas-de-publicacao-visiveis.md) - Mesmo princípio de transparência por Post que este EDR se apoia (externalIds/status como fonte de verdade)
