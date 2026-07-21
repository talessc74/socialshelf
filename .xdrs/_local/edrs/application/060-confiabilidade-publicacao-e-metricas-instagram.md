---
name: _local-edr-policy-060-confiabilidade-de-publicacao-no-instagram
description: Três correções da mesma investigação de produção (sessão de 21/07/2026) — DeletePostUseCase/FirestorePostRepository.delete() sem índice do Firestore quebrava o "Descartar"; posts com status 'failed' não apareciam em nenhuma tela; e o escopo instagram_business_manage_insights nunca era pedido no Login do Instagram direto, derrubando a leitura de métricas mesmo com a conta liberada e publicando normal. Use ao mexer em PostRepository.delete, na tela /dashboard/scheduled, ou nos escopos OAuth do Instagram.
apply-to: apps/api — DeletePostUseCase, FirestorePostRepository, instagram-client.ts; apps/web — /dashboard/scheduled; apps/publisher — MetaPublisher, MetaAnalyticsReader
valid-from: 2026-07-21
---

# _local-edr-policy-060: Confiabilidade de Publicação no Instagram

## Context and Problem Statement

Investigação de produção disparada por três relatos do usuário na mesma sessão: um post aguardando aprovação nunca sumia ao clicar "Descartar"; um post que falhava ao publicar mostrava um aviso de erro por poucos segundos e depois desaparecia por completo; e, depois de resolver a publicação, o Dashboard de Performance continuava sem carregar métricas do Instagram. Três causas raiz distintas, cada uma exigindo decisão de implementação própria.

## Decision Outcome

**Cada causa raiz corrigida na camada certa — índice de Firestore trocado por delete direto no path, status sem UI virou seção nova, e escopo OAuth faltante identificado e adicionado — sem tentar resolver as três com uma correção genérica.**

### Details

**"Descartar" não funcionava: `FirestorePostRepository.delete()` fazia `collectionGroup('posts').where('id','==',id)` sem índice**

Mesma classe de bug já documentada em EDR-042/047 (índice de campo único ausente pra escopo COLLECTION_GROUP), agora numa parte do código ainda não coberta. Em vez de adicionar mais um índice frágil ao `firestore.indexes.json` (dependente de deploy e sujeito ao mesmo tipo de lacuna), `delete()` passou a apagar direto pelo path do documento (`users/{userId}/brands/{brandId}/posts/{id}`), o mesmo padrão já usado em `findByIdAndBrand`/`claimForPublishing`. `PostRepository.delete()` (interface de domínio) mudou de `delete(id)` pra `delete(id, userId, brandId)`.

**Consequência da mudança de assinatura, corrigida em PR separado**: uma feature de campanhas desenvolvida em paralelo (`cancelPendingCampaignPosts`, PR #184) tinha uma chamada a `postRepo.delete(post.id)` que não existia ainda quando esta EDR foi escrita — o merge subsequente quebrou o build, corrigido no PR #185. Mudança de assinatura em porta de domínio compartilhada tem raio de alcance sobre qualquer branch em paralelo que não tenha sido rebasada; vale considerar isso ao decidir se uma mudança de assinatura é preferível a uma alternativa aditiva.

**Post que falha 100% (todas as redes-alvo) virava `status: 'failed'` e desaparecia da tela — nenhuma lista busca esse status**

`/dashboard/scheduled` buscava só `scheduled`, `published` e `ai-draft`. Nova seção "Falhou ao publicar" busca `status='failed'` e reaproveita `PostCard` (nova prop `isFailed`) com Editar/Tentar novamente/Descartar — editar sem trocar a data mantém a data original (o post já tentou publicar nela e falhou), em vez de forçar uma data futura nova.

**Mensagens de erro cruas da Graph API — `friendlyReason()` estendido**

`MetaPublisher` já tinha o padrão (isolado em `XPublisher` antes) de reconhecer causas conhecidas e devolver frase acionável em vez do JSON da Graph API. Generalizado: `code 190` (OAuthException) agora distingue Instagram de Facebook — pra Instagram, menciona a exigência de conta Business/Creator antes de sugerir reconectar, porque "reconecte a conta" sozinho é uma promessa falsa pra quem tem conta pessoal (ver `_local-bdr-policy-012`). O mesmo padrão foi replicado em `MetaAnalyticsReader` pro `code 10` ("Application does not have permission for this action") na leitura de métricas.

**Falso positivo descartado: "shares" não foi renomeado pra "sends"**

Uma correção baseada em busca na web (sem verificar contra a API real) trocou a métrica `shares` por `sends` no pedido de Insights do Instagram, partindo da suposição errada de que a Meta tinha renomeado a métrica. Revertido no mesmo dia: a própria Graph API, ao rejeitar `sends`, devolveu a lista de métricas válidas — `shares` está nela, `sends` não. Lição registrada aqui pra não repetir: quando o comportamento de uma API de terceiro pode ser verificado direto (rodando contra ela ou lendo o erro que ela mesma devolve), isso pesa mais que uma busca genérica sem essa verificação.

**Causa real da falha de Insights: `instagram_business_manage_insights` nunca era pedido no Login do Instagram direto**

`buildInstagramAuthUrl` (`_local-edr-policy-057`) pedia só `instagram_business_basic` e `instagram_business_content_publish` na tela de consentimento — nunca `instagram_business_manage_insights`, a permissão separada e obrigatória pra ler Insights. Publicar e ler métricas são escopos independentes: uma conta pode estar liberada como testadora do app e publicando normalmente e ainda assim não ter acesso a Insights, porque o escopo nunca foi solicitado no OAuth. Escopo adicionado tanto na URL de autorização quanto no registro de `scopes` salvo na conexão. O fluxo via Facebook Página (`meta-client.ts`) já pedia o escopo equivalente da família antiga (`instagram_manage_insights`) — só o Login direto tinha o gap.

**Toda conta já conectada via Login do Instagram direto precisa reconectar**

O token salvo antes desta correção não carrega o escopo novo — a Graph API não concede retroativamente uma permissão que não foi pedida no consentimento original. Não há caminho de código que contorne isso; é inerente ao modelo de OAuth da Meta.

## What this does not solve

Não cobre o mesmo tipo de mensagem crua de erro em `LinkedInPublisher`/`TikTokPublisher`/`XPublisher` fora do caso já tratado (plano pago do X) — mesmo padrão, formato de erro de cada API ainda não verificado contra caso real. Não resolve o bug reportado à parte de "aspect ratio não suportado" numa imagem específica do Instagram, nem o backlog de posts represados em "Falhou ao publicar" represados desde antes desta correção.

## References

- [_local-edr-policy-042-campanha-revisao-pos-saga-do-indice](042-campanha-revisao-pos-saga-do-indice.md) - Mesma classe de bug de índice de coleção ausente, primeira ocorrência documentada
- [_local-edr-policy-054-falhas-de-publicacao-visiveis](054-falhas-de-publicacao-visiveis.md) - splitPublishOutcome/badges por rede, trabalho paralelo que já cobria parte do "confuso o que publica e o que não"
- [_local-edr-policy-057-login-do-instagram-sem-facebook](057-login-do-instagram-sem-facebook.md) - Fluxo de conexão cujo escopo de Insights faltava
- [_local-bdr-policy-012-onboarding-meta-em-modo-de-desenvolvimento](../../bdrs/product/012-onboarding-meta-em-modo-de-desenvolvimento.md) - Allowlist de testadores e comunicação da exigência de conta profissional, contexto de negócio desta investigação
- PRs talessc74/socialshelf#179, #180, #181 (revertido em #182), #183
