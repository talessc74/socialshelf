---
name: _local-edr-policy-042-campanha-revisao-pos-saga-do-indice
description: Revisão completa da implementação de campanhas de fotos após duas rodadas reativas de correção do mesmo bug de índice — mais 2 queries de campo único com o mesmo defeito latente, 2 telas com o mesmo bug de erro engolido, e um bug estrutural de N+1 requisição por miniatura que esgotava sozinho o rate limit global. Use ao mexer em qualquer repositório/rota/tela de campanha, ou ao investigar rate limit / FAILED_PRECONDITION nessa área.
apply-to: apps/api — infrastructure/firestore (campanhas), routes/generation.routes.ts; apps/generator — routes/generation.routes.ts; apps/web — /dashboard/campaigns, lib/api.ts
valid-from: 2026-07-11
---

# _local-edr-policy-042: Campanha — Revisão Pós-Saga do Índice

## Context and Problem Statement

Depois de duas rodadas seguidas de "corrigi, deployei, o usuário testou, quebrou de novo" no mesmo bug de índice do Firestore (`_local-edr-policy-039`), o usuário pediu explicitamente para parar de reagir e revisar toda a implementação de campanhas de uma vez, em vez de mais um ciclo de tentativa-e-erro. A pergunta era: existem outros bugs da mesma classe (índice de campo único, erro engolido silenciosamente) escondidos em código que ainda não foi exercitado em produção?

## Decision Outcome

**Auditoria de todos os repositórios Firestore, rotas e telas de campanha, procurando ativamente pelas mesmas duas classes de bug já identificadas (query de campo único em `collectionGroup`, `useQuery` sem ler `error`) em vez de esperar o próximo report do usuário — encontrou 3 ocorrências adicionais, mais um bug estrutural novo (N+1 requisição de miniatura) que nenhuma das rodadas anteriores tinha investigado.**

### Details

**`deleteByCampaign` tinha o mesmo bug de índice de campo único, e roda em todo "Gerar linha do tempo"**

`FirestoreCampaignItemRepository.deleteByCampaign` fazia `where('campaignId', '==', campaignId)` sem `orderBy` — mesmo padrão de campo único que já quebrou `photos` duas vezes. Esse método roda dentro de `GenerateCampaignTimelineUseCase.execute`, antes de recalcular a linha do tempo, então qualquer clique em "Gerar linha do tempo" (inclusive o primeiro, mesmo com a coleção vazia — `FAILED_PRECONDITION` é erro de plano de consulta, independe de haver dado) tinha risco real de repetir o mesmo erro. Corrigido com `.orderBy('order')`, o que alinha a consulta exatamente com `findByCampaign` (campo a campo) — reaproveitando o mesmo índice composto já `READY`, sem precisar declarar um novo.

**`PhotoCampaignRepository.findById` tinha o mesmo bug, mas em código sem nenhum chamador hoje**

`FirestorePhotoCampaignRepository.findById` (busca por id sem precisar de userId/brandId) também filtrava `collectionGroup('photo_campaigns')` só por `id`, sem `orderBy`, sem nenhum índice declarado em `firestore.indexes.json`. Auditoria de chamadores confirmou que nada no código hoje invoca esse método — existe só para completar a interface `PhotoCampaignRepository`, mesmo padrão dos outros repositórios do projeto (`PostRepository.findById`, `OAuthRepository.findById`, todos com um `findById` de conveniência mesmo quando nem toda rota o usa). Por não ter chamador, esse bug nunca apareceu — mas explodiria na primeira vez que alguém o usasse. Corrigido preventivamente com `.orderBy('createdAt')` + novo índice composto (`photo_campaigns`: `id` + `createdAt`) em `firestore.indexes.json`.

Uma varredura mais ampla (fora do escopo de campanhas, então não corrigida aqui) encontrou o mesmo padrão em `FirestoreOAuthRepository.findById`/`findByPairwise`/`delete` (`apps/api` e `apps/publisher`) — também sem chamador em produção hoje, mesmo diagnóstico de "dead code com bug latente". Fica registrado aqui como possível investigação futura, mas não é a causa dos problemas de conexão X/LinkedIn já reportados pelo usuário nesta sessão: `findByBrandAndPlatform`/`findByBrand`, que são os métodos realmente usados no fluxo de conexão, usam `.collection()` de escopo único (não `collectionGroup`), e portanto não têm esse bug.

**Telas de lista e criação de campanha tinham o mesmo bug de erro engolido**

`/dashboard/campaigns` (lista) e `/dashboard/campaigns/new` (criação) liam só `data` dos `useQuery` de `listCampaigns`/`getConnections`, nunca `error` — exatamente o bug já corrigido em upload/timeline (`_local-edr-policy-039`), mas que nunca tinha sido replicado aqui porque essas duas telas foram escritas antes daquele fix e ninguém voltou pra aplicar o mesmo padrão retroativamente. Uma falha de rede na lista de campanhas aparecia como "Nenhuma campanha ainda" — potencialmente escondendo campanhas reais do usuário. Ambas ganharam o mesmo tratamento (mensagem de erro em vermelho antes do estado vazio).

**Miniatura por foto esgotava sozinha o rate limit global — bug estrutural, não só volume de teste**

Investigando um "Rate limit exceeded, retry in 1 minute" (429 do `@fastify/rate-limit`, 100 req/min por IP, `_local-edr-policy-009`) que apareceu ao clicar em "Gerar linha do tempo", a causa raiz não era só o volume de testes do dia: `UploadedPhotoThumbnail` (upload) e `ItemThumbnail` (timeline) resolviam a URL assinada de cada foto com um `useQuery` próprio — uma requisição HTTP a `GET /generation-images/signed-url` por miniatura. Uma campanha com 148 fotos carrega 148 requisições só pra desenhar a grade, sozinho já perto do teto de 100/min; qualquer ação seguinte tinha grande chance de ser a requisição que estourava a cota. Isso teria acontecido de novo com qualquer campanha grande, mesmo sem nenhum teste repetido — é um limite estrutural da arquitetura anterior (uma miniatura = uma requisição), não um artefato do dia de testes.

Corrigido com um endpoint em lote: `POST /images/signed-urls` no generator-service (assinar URL é uma operação criptográfica local com a chave da service account, sem round-trip de rede por item — resolver 148 de uma vez é barato) e `POST /generation-images/signed-urls` no api-service fazendo o proxy (mesma validação de ownership por prefixo `userId/` do endpoint singular). `UploadedPhotoThumbnail`/`ItemThumbnail` deixaram de ter `useQuery` próprio — viraram componentes de apresentação puros (`url: string | undefined`), e cada página de campanha faz uma única `useQuery` pro lote inteiro de `storagePath`s da tela. Os endpoints singulares (`getImageUrl`/`GET /images/signed-url`/`GET /generation-images/signed-url`) continuam existindo — usados pelas outras telas do produto que mostram poucas imagens por vez (posts agendados, resultado de geração), onde o padrão N+1 nunca foi um problema real, então não foram tocadas.

**Mensagem crua de rate limit vazando em inglês**

O mesmo 429 acima, antes da causa raiz de volume ser identificada, mostrava o `message` padrão do `@fastify/rate-limit` direto na tela ("Rate limit exceeded, retry in 1 minute"), sem tradução — mesma classe de bug já corrigida nesta sessão pra outras rotas (`_local-edr-policy-041`). `apiFetch` (`apps/web/src/lib/api.ts`) agora trata `status === 429` antes de tentar ler o corpo da resposta, montando uma mensagem em pt-BR usando o header `Retry-After` (já documentado em `_local-edr-policy-009`) quando presente. Esse tratamento é global (dentro do helper compartilhado por toda a API), não específico de campanhas — qualquer rota do produto que bater o rate limit agora mostra a mensagem traduzida.

## What this does not solve

`FirestoreOAuthRepository.findById`/`findByPairwise`/`delete` continuam com o mesmo bug de índice de campo único (dead code hoje, sem chamador) — não corrigido porque está fora do escopo de campanhas desta revisão. O limite global de 100 req/min continua igual para todo o resto do produto; a correção de miniaturas em lote reduz drasticamente o número de requisições das telas de campanha, mas não é um aumento de cota nem uma exceção de rota — nenhuma mudança na política de rate limiting em si.

## References

- [_local-edr-policy-039-campanha-de-fotos-implementacao-fase-1](039-campanha-de-fotos-implementacao.md) - Implementação original e as duas rodadas de correção do bug de índice que motivaram esta revisão
- [_local-edr-policy-009-rate-limiting-global-api](009-rate-limiting.md) - Configuração e semântica do rate limit global (`Retry-After`, limites por rota)
- [_local-edr-policy-041-melhor-janela-com-dado-real-de-horario](041-melhor-janela-com-dado-real-de-horario.md) - Mesmo padrão de tradução de mensagem de erro crua
