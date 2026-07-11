---
name: _local-edr-policy-038-tick-de-autonomia-implementacao
description: Implementação do tick de autonomia (_local-adr-policy-040) — novas portas de domínio, discovery de marcas via collectionGroup, contador diário atômico, cliente HTTP entre publisher-service e generator-service, e a evolução de 1x/dia para de hora em hora com gate de horário. Use ao mexer em qualquer peça do pipeline automático/semi-automático ou ao investigar por que um post automático não foi gerado/publicado.
apply-to: packages/domain — novas portas; apps/generator — classificação semântica; apps/publisher — orquestração do tick; apps/api — validação de maxAutoPostsPerDay; apps/web — configuração em /dashboard/brand
valid-from: 2026-07-10
---

# _local-edr-policy-038: Tick de Autonomia — Implementação

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

**Marcação de origem + post completo em ambiente próprio (2026-07-10)** — fecha parcialmente a lacuna de auditoria registrada abaixo: usuário perguntou onde consegue ver o que o modo automático publicou sozinho. Novo campo `Post.origin: 'manual' | 'autonomy-tick'` (`packages/domain`) — `'autonomy-tick'` setado só quando `GenerateContentUseCase` é chamado a partir de `GeneratorAutonomyClient.generate()` (o tick passa `origin: 'autonomy-tick'` no corpo de `POST /generate`; qualquer chamada vinda da UI via api-service omite o campo, que faz default para `'manual'` no zod schema). Documentos já existentes no Firestore sem esse campo são lidos como `'manual'` nos três `FirestorePostRepository` (api, generator, publisher) — retrocompatibilidade sem migração.

O selo "Automático" aparece em `PublishedPostCard` (`/dashboard/scheduled`) ao lado do "✓ Publicado" quando `origin === 'autonomy-tick'`. Um botão "Ver post completo" abre `PostDetailModal` — texto por completo por plataforma (não truncado como na prévia do card), todas as imagens, vídeo quando houver, e um link "Ver no {rede}" para o post real quando dá pra construir essa URL só a partir do `externalId` já salvo, sem chamada de API extra: funciona para X (`/i/web/status/{id}`), LinkedIn (`/feed/update/{urn}/`) e Facebook (`facebook.com/{id}`) — não para Instagram (o media id numérico não é o shortcode do permalink, que só a Graph API devolve) nem TikTok (o publish é assíncrono via PULL_FROM_URL; o id devolvido no momento da publicação não é um link pro vídeo).

Escopo desta fatia: só `PublishedPostCard`. `PostCard` (posts agendados, ainda não publicados) não ganhou o selo nem o modal — não foi pedido, e rascunhos `ai-draft` criados pelo modo semi-automático continuam sem nenhuma tela própria de revisão (ver abaixo).

## What this does not solve

Retry de uma marca que falhou no mesmo slot do dia (só tenta de novo no próximo slot/tick — ver adendo 2026-07-11 abaixo sobre múltiplos slots por dia). Notificação ao usuário quando um post é publicado automaticamente — hoje só existe o registro no resultado do tick (`{results: [...]}`) e o selo na tela de Publicados, sem nenhum canal de aviso proativo (e-mail, push). Nenhuma prévia do que o modo automático vai publicar antes de acontecer: como o tick decide e publica dentro da mesma chamada que gera o conteúdo, não existe um estado intermediário no backend pra mostrar — não é uma lacuna de UI, é como a arquitetura funciona hoje.

**Tela de rascunhos do semi-automático — fecha a lacuna descrita acima (2026-07-11)** — usuário perguntou onde consegue ver o que o modo automático está planejando publicar e se existe algum horário fixo. Resposta trocada por: (a) confirmação de que o tick roda 1x por dia, 12h UTC (9h em Brasília), sem fila nem `scheduledAt` futuro — decide e publica no mesmo instante; (b) nova seção "Aguardando sua aprovação" em `/dashboard/scheduled` (`apps/web/src/app/dashboard/scheduled/page.tsx`), visível acima do calendário/lista, que lista os `Post`s com `status: 'ai-draft'` — os rascunhos que o modo semi-automático gera e não publica sozinho, porque `AutonomyTickUseCase` só chama `publishPostUseCase` quando `autonomyLevel === 'automatic'`.

Zero endpoint novo: `GET /posts?status=ai-draft`, `PUT /posts/:id`, `POST /posts/:id/publish` e `DELETE /posts/:id` já existiam e já cobriam listar/editar/aprovar-publicar/descartar — só faltava a tela. `PostCard` (já usado pra posts agendados) ganhou uma prop `isDraft` em vez de um componente novo — reaproveita 100% a edição de texto/foto/data e os botões de publicar/cancelar já existentes, só troca rótulos ("Aprovar e publicar agora", "Descartar") e o crachá do topo.

**Filtro por `origin: 'autonomy-tick'`, não só por `status: 'ai-draft'`** — descoberta no meio da investigação: `GenerateContentUseCase.save` (apps/generator) grava `status: 'ai-draft'` em **toda** geração, inclusive a manual via `/dashboard/generate` — e o fluxo de publicar/agendar dali sempre cria um `Post` novo via `api.createPost` em vez de reaproveitar/atualizar esse rascunho original, que fica órfão pra sempre no Firestore. Sem filtrar por `origin === 'autonomy-tick'`, a tela nova ficaria cheia de lixo histórico de toda geração manual já feita. Esse acúmulo de rascunhos órfãos em si não foi limpo nem tratado nesta rodada — só evitado na tela nova via filtro; segue como débito técnico não resolvido (nenhuma rotina de limpeza existe para `status: 'ai-draft'` sem dono).

**Editar sem definir data mantém o status `ai-draft`** — `UpdatePostUseCase` já decidia o novo `status` a partir de `scheduledAt`: `undefined` preserva o status atual, `null` explícito vira `'draft'` (um status hoje invisível em qualquer tela), uma data futura vira `'scheduled'`. A tela de edição do rascunho aproveita exatamente essa distinção existente — campo de data em branco no "Salvar" envia `scheduledAt: undefined` (não `null`), então o rascunho editado continua aparecendo na seção de aprovação em vez de sumir num status sem UI nenhuma. Definir uma data move o post pra `'scheduled'` e ele passa a aparecer na lista normal de agendados — "agendar um rascunho" não precisou de nenhum botão novo, só reaproveitar o formulário de edição que já existia.

**Tick de hora em hora, com slots de horário, pra `maxAutoPostsPerDay` > 1 virar realidade (2026-07-11)** — usuário perguntou o que acontece se uma marca precisar publicar mais de uma vez por dia, já que o tick só rodava 1x. Achado real: `processBrand` sempre tentou exatamente 1 tópico por chamada — com o tick 1x/dia, `maxAutoPostsPerDay` configurado para 2 ou 3 nunca tinha efeito nenhum, o campo prometia um teto que o sistema jamais alcançava. Correção: Cloud Scheduler passa de `0 12 * * *` (1x/dia) para `0 * * * *` (de hora em hora) — `.github/workflows/deploy.yml` precisou do `--schedule` em **ambos** os branches (`update` e `create`) do passo, não só no `create`, porque o job `publisher-autonomy-tick` já existe em produção desde a versão 1x/dia e só o branch `update` roda a partir de agora.

Rodar de hora em hora sozinho geraria um post por hora, não por dia — o gate novo é `computeDailySlotHours(maxAutoPostsPerDay)` (`packages/domain/src/value-objects/DailyPostingSlots.ts`), a mesma função que já distribuía os itens de uma campanha ao longo do dia (`computeScheduledTimes` em `apps/api/.../locationClustering.ts`, refatorado pra reaproveitar), promovida pra `packages/domain` por ser a mesma regra de negócio ("espalhar N posts entre 9h-21h Brasília") usada agora em dois serviços diferentes. `AutonomyTickUseCase.processBrand` lê `dailyCounter.getCount` (método novo no port, sem transação — só leitura) e compara contra quantos slots já "abriram" até a hora atual (`America/Sao_Paulo`, mesma fixação de fuso de `_local-edr-policy-041`); se a marca já usou todos os slots que já abriram, pula com `'skipped-not-yet-time'` antes de gastar qualquer chamada de sugestão/classificação de tópico.

**Contador diário passa a valer pros dois níveis de autonomia, não só automático** — antes, `incrementIfUnderLimit` só era chamado dentro de `if (wantsAutoPublish)`, ou seja, só quando a marca é automática e o tópico é elegível; semi-automático nunca consultava contador nenhum, e não precisava — o tick só rodava 1x/dia mesmo. Com o tick de hora em hora, sem essa mudança o semi-automático geraria um rascunho novo a cada hora, sem limite. O incremento (e o gate de horário acima) agora rodam pra qualquer marca elegível, automática ou semi-automática — o campo `maxAutoPostsPerDay` vira, na prática, "quantas vezes por dia a automação tenta gerar algo", publicando ou não sozinha dependendo do nível.

O `getCount` (leitura) e o `incrementIfUnderLimit` (escrita atômica) continuam sendo dois métodos separados de propósito: o primeiro é um gate barato de "ainda não é hora" que evita chamadas de IA desnecessárias fora de horário; o segundo continua como admissão final atômica logo antes de gerar, pra não estourar o teto se duas execuções do tick se sobrepuserem.

**Correção real ao confirmar o deploy: `--headers` não existe em `gcloud scheduler jobs update`** — ao verificar se o `--schedule` novo realmente tinha sido aplicado em produção, o log do passo (mascarado por `continue-on-error: true`, então o job do GitHub Actions aparecia verde) mostrava `ERROR: unrecognized arguments: --headers=*** (did you mean '--clear-headers'?)`, exit code 2 — o branch `update` inteiro falhava antes de aplicar qualquer mudança, então o `--schedule` novo nunca chegava a valer. O flag `--headers` só existe em `gcloud scheduler jobs create http`; o equivalente em `update` é `--update-headers`. Esse bug já existia antes desta mudança (afetava os três jobs de Cloud Scheduler do projeto, não só o de autonomia) — corrigido nos três branches `update` (`publisher-scheduled-tick`, `publisher-autonomy-tick`, `generator-video-cleanup-tick`) na mesma rodada, já que o mesmo padrão errado tinha sido copiado nos três.

## References

- [_local-adr-policy-040-ativacao-do-modo-automatico-de-publicacao](../../adrs/application/040-ativacao-modo-automatico-publicacao.md) - Decisão estrutural que esta fatia implementa
- [_local-edr-policy-037-publicar-em-mais-redes-apos-o-video](037-publicar-em-outras-redes-apos-video.md) - Mesma exclusão de TikTok, mesmo padrão de reaproveitar índice/método existente em vez de mudar contrato
