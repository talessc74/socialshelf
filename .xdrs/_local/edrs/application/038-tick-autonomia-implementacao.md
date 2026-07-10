---
name: _local-edr-policy-038-tick-diario-de-autonomia-implementacao
description: Implementação do tick diário de autonomia (_local-adr-policy-040) — novas portas de domínio, discovery de marcas via collectionGroup, contador diário atômico, e cliente HTTP entre publisher-service e generator-service. Use ao mexer em qualquer peça do pipeline automático/semi-automático ou ao investigar por que um post automático não foi gerado/publicado.
apply-to: packages/domain — novas portas; apps/generator — classificação semântica; apps/publisher — orquestração do tick; apps/api — validação de maxAutoPostsPerDay; apps/web — configuração em /dashboard/brand
valid-from: 2026-07-10
---

# _local-edr-policy-038: Tick Diário de Autonomia — Implementação

## Context and Problem Statement

`_local-adr-policy-040` decide ativar o modo automático/semi-automático com três guardrails obrigatórios. Como implementar isso concretamente sem tocar `GenerateContentUseCase` (já bem coberto por teste, usado pelo fluxo manual todos os dias) e sem criar uma dependência circular de deploy entre publisher-service e generator-service?

## Decision Outcome

**`AutonomyTickUseCase` em apps/publisher orquestra tudo via 3 novas portas de domínio + 1 cliente HTTP local para generator-service; reencontra o post recém-criado por `postRepo.findByBrand(..., 'ai-draft')` em vez de alterar o retorno de `GenerateContentUseCase.execute`.**

### Details

**3 novas portas de domínio, cada uma com um único implementador — não estendendo portas existentes**

- `TopicAutonomyMatcherPort` (`classify`) — implementada por `GeminiTopicAutonomyMatcher` em apps/generator, exposta via `POST /pauta/classify-autonomy` (internal-secret). Curto-circuita sem chamar o modelo quando a marca não tem nenhum tópico liberado nem bloqueado — nesse caso a resposta (`blocked: false, autoPublishEligible: false`) já é conhecida sem julgamento nenhum.
- `AutonomyBrandDiscoveryPort` (`findEligibleBrands`) — implementada só em apps/publisher (`FirestoreAutonomyBrandDiscovery`), não em `BrandProfileRepository`. `BrandProfileRepository` (api, generator) sempre opera com userId/brandId já conhecidos; forçar os outros dois adapters a implementar uma varredura global que nunca usariam violaria segregação de interface sem ganho nenhum.
- `AutonomyDailyCounterRepository` (`incrementIfUnderLimit`) — implementada só em apps/publisher (`FirestoreAutonomyDailyCounterRepository`), um documento por (marca, dia) com incremento atômico via transação Firestore. Não reaproveita o histórico de `Post` porque não existe hoje um campo que distinga "publicado pelo pipeline automático" de "publicado por ação humana no mesmo dia" — criar esse campo mudaria a modelagem de `Post` em todo o sistema por causa de um contador de uso único.

**Discovery de marcas via `collectionGroup` + redução em memória**

`BrandProfile` é versionado e imutável (`_local-adr-policy-025`); Firestore não agrupa (`GROUP BY`) nativamente numa `collectionGroup` query, então `FirestoreAutonomyBrandDiscovery` varre `collectionGroup('brand_profiles')` inteiro e reduz em memória para a versão mais recente por (userId, brandId), extraído do path do documento (`users/{userId}/brands/{brandId}/brand_profiles/v{version}`). Custo conhecido: cresce com o total de versões já salvas, não só com o número de marcas — aceitável para um tick diário no volume atual; revisitar se isso virar gargalo real, não antes.

**Reaproveitar `findByBrand(..., 'ai-draft')` em vez de mudar o contrato de `GenerateContentUseCase`**

`GenerateContentUseCase.execute` já salva um `Post` com `status: 'ai-draft'` internamente, mas devolve só o `GenerationRequest` — sem o id do post criado. Duas opções foram consideradas: (a) mudar o retorno de `execute()` para incluir o `postId`, quebrando o contrato usado por `/generate` e por todos os testes existentes de `GenerateContentUseCase.test.ts`; ou (b) reencontrar o rascunho recém-criado via `postRepo.findByBrand(userId, brandId, 'ai-draft')`, que já devolve ordenado por `createdAt desc` (índice composto já provisionado em produção, usado por `findByBrand` com filtro de status desde antes desta feature). Optou-se por (b) — zero mudança em `GenerateContentUseCase` e seus testes, reaproveitando um índice e um método que já existiam prontos para este uso.

**Cliente HTTP local, não porta de domínio**

`GeneratorAutonomyClient` (apps/publisher/src/infrastructure/generator/) não é uma porta em `packages/domain` — é fronteira de infraestrutura específica de como os serviços deste deploy conversam entre si, mesmo espírito de `resolveImageUrl`/`resolveTikTokVideoUrl` já existentes em `publish.routes.ts`. Reaproveita `fetchInternal` (`apps/publisher/src/lib/serviceAuth.ts`), já usado por outras chamadas publisher→generator.

**Só a pauta de maior `audienceFitScore` é considerada por marca por tick**

`SuggestTopicsUseCase` já devolve a lista ordenada por aderência. O tick classifica só a primeira — não itera a lista inteira até achar uma não-bloqueada. Isso limita o custo a no máximo 1 chamada de classificação por marca por dia (em vez de até N, sendo N o tamanho da lista de sugestões), ao custo de: se a pauta #1 for bloqueada, a marca simplesmente não gera nada naquele tick — tenta de novo no dia seguinte com uma lista atualizada de notícias, em vez de cair para a #2 no mesmo dia.

**Contador diário incrementado antes de gerar, não depois de publicar**

Quando o modo é automático e a pauta é elegível, `incrementIfUnderLimit` é chamado (e o contador incrementado) antes de `generatorClient.generate` — não depois de `publishPostUseCase.execute`. Se o teto já foi atingido, a marca é pulada antes de gastar uma geração de IA inteira (custo real) para um post que não seria publicado de qualquer forma nesse tick.

**TikTok fora do alvo automático**

Mesma exclusão já registrada em `_local-edr-policy-037`: o pipeline automático só monta post de imagem/texto, sem etapa de upload/composição de vídeo — uma marca só conectada ao TikTok é pulada (`skipped-no-platforms`).

**Isolamento de falha por marca**

`AutonomyTickUseCase.execute` envolve `processBrand` de cada marca em try/catch individual — uma marca com erro (ex: Firestore indisponível, generator-service fora do ar) não impede o processamento das demais no mesmo tick, mesmo padrão já usado por `ScheduledPostsPoller` e pelo job de limpeza de vídeo.

**Checkbox antes de campo de texto em branco (2026-07-10)** — usuário relatou em teste real que a caixa de texto livre para `autoPublishTopics`/`blockedTopics` intimida quem está começando (não sabe o que digitar). Novo componente `TopicChecklist` (apps/web/src/components/) mostra primeiro uma grade de checkboxes com categorias amplas e genéricas o bastante para fazer sentido em qualquer segmento (`AUTO_PUBLISH_TOPIC_OPTIONS`/`BLOCKED_TOPIC_OPTIONS` em `brand/page.tsx`) — não geradas por IA a partir do `BrandProfile`, uma lista fixa e curada, mais previsível e sem custo de mais uma chamada de modelo. O campo de texto livre continua existindo para quem já sabe exatamente o que quer, mas escondido atrás de um `<details>` recolhido por padrão, em vez de ser a primeira coisa que a pessoa vê.

Marcar um checkbox e digitar o mesmo texto no campo livre têm o mesmo efeito — ambos só adicionam/removem a string do mesmo array (`autoPublishTopics`/`blockedTopics`); não há dois modelos de dado, só duas formas de editar o mesmo. `TopicChecklist` mostra como chip removível apenas os valores que não batem com nenhuma opção do checkbox, para não duplicar visualmente a mesma entrada em dois lugares.

## What this does not solve

Retry de uma marca que falhou no mesmo dia (só tenta de novo no próximo tick, 24h depois). Notificação ao usuário quando um post é publicado automaticamente — hoje só existe o registro no resultado do tick (`{results: [...]}`), sem nenhum canal de aviso proativo. Dashboard de auditoria do que o modo automático já publicou — para investigar, é preciso olhar os `Post`s com `status: 'published'` da marca sem nenhuma marcação de origem "automático" vs. manual.

## References

- [_local-adr-policy-040-ativacao-do-modo-automatico-de-publicacao](../../adrs/application/040-ativacao-modo-automatico-publicacao.md) - Decisão estrutural que esta fatia implementa
- [_local-edr-policy-037-publicar-em-mais-redes-apos-o-video](037-publicar-em-outras-redes-apos-video.md) - Mesma exclusão de TikTok, mesmo padrão de reaproveitar índice/método existente em vez de mudar contrato
