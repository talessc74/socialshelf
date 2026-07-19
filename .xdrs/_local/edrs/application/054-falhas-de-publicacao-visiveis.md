---
name: _local-edr-policy-054-falhas-de-publicacao-visiveis
description: Falha de publicação por rede era escondida em três camadas — PublishPostUseCase marca 'published' em sucesso parcial, AutonomyTickUseCase ignorava o resultado e sempre logava 'published', e o card de post publicado mostrava toda rede-alvo como publicada sem olhar externalIds. Agora o histórico do tick e o card refletem o que cada rede recebeu de fato. Use ao mexer em AutonomyTickUseCase, no card de posts publicados ou no PostDetailModal.
apply-to: apps/publisher — AutonomyTickUseCase; apps/web — dashboard/scheduled/page.tsx (PublishedPostCard), components/PostDetailModal.tsx, components/AutonomyTickHistory.tsx; packages/domain — AutonomyTickLogEntry (AutonomyTickAction)
valid-from: 2026-07-19
---

# _local-edr-policy-054: Falhas de publicação visíveis

## Context and Problem Statement

Usuário reportou (com prints) que o painel marcava um post como "✓ Publicado" nas quatro redes
(Facebook, LinkedIn, X, Instagram), mas o conteúdo não aparecia em nenhuma — ou aparecia só numa.
Resumo dele: "tá bem confuso o que publica e o que não publica".

A investigação achou o mesmo defeito repetido em três camadas, cada uma escondendo a falha da
seguinte:

1. **`PublishPostUseCase`** publica rede a rede num laço. Grava um `externalIds[platform]` por
   rede que recebeu o post de fato, e só marca o Post inteiro como `failed` quando **todas**
   falham (`allFailed = results.length === 0`). Sucesso parcial (1 rede ok, 3 falham) vira
   `status: 'published'`, e os motivos de falha (`failedPlatforms`) são retornados mas nunca
   persistidos.

2. **`AutonomyTickUseCase`** (os posts "Automático") chamava `publishPostUseCase.execute(...)` e
   **descartava o retorno inteiro**, sempre registrando `action: 'published'`, `error: null` no
   histórico do tick. Mesmo uma falha total por rede (token expirado, erro da API do Instagram)
   ficava invisível — o único caso capturado era `execute()` lançar antes de qualquer rede.

3. **O card de post publicado** (`PublishedPostCard`) renderizava um chip pra cada rede em
   `post.content` (as redes-alvo) e um "✓ Publicado" genérico, sem nunca consultar `externalIds`.
   Um post que só chegou no Facebook mostrava Facebook + LinkedIn + X + Instagram como se todas
   tivessem publicado.

O dado pra distinguir "publicou de fato" de "só era alvo" já existia em todo Post
(`externalIds`, um id por rede que recebeu o post) e já era serializado pra web — só não era
usado.

## Decision Outcome

**Tornar a falha por rede visível em cada camada, usando `externalIds` como fonte da verdade,
sem mudar a semântica de status do Post (que rippleria por todos os filtros de status).**

### Details

**Card e modal derivam o resultado por rede de `externalIds`**

`PublishedPostCard` e `PostDetailModal` passam a classificar cada rede-alvo: com `externalId` a
rede publicou (chip verde); sem `externalId` num post `published` a rede não publicou (chip
vermelho). O cabeçalho vira "Publicado em parte" quando alguma rede-alvo ficou sem `externalId`, e
o card mostra uma linha dizendo em quais redes não chegou e sugerindo conferir a conexão / republicar.

**Guarda pra dados legados: `externalIds` vazio cai no comportamento neutro**

Um post `published` com `externalIds` vazio (dado anterior ao rastreio por rede) não pode existir
pela lógica atual de `PublishPostUseCase` (todas falharem → `failed`), mas por segurança o card
volta ao display antigo (chips neutros, "✓ Publicado") quando não há nenhum `externalId`, pra
nunca acusar "falhou" indevidamente em dados históricos.

**Histórico do tick reflete a verdade: nova ação `published-partial`**

`AutonomyTickUseCase` passa a inspecionar o `PublishPostResult`. Sem falhas → `published` (como
antes). Alguma falha com pelo menos uma rede ok → nova ação `published-partial`, com os motivos
por rede concatenados no campo `error`. Nenhuma rede ok → `error` (não `published`), também com
os motivos. No caminho automático, `targetPlatforms` é derivado das conexões existentes, então
esses motivos costumam ser erros reais de API (token, limite), não "sem conexão" — exatamente o
diagnóstico que faltava.

**Status do Post fica como está (`published` no sucesso parcial)**

Não introduzir um status `partially-published`: isso obrigaria refinar todos os filtros
`status === 'published'` (query da lista de publicados na web, enum de status da rota de posts na
api) e arriscava sumir com o post da lista de Publicados. A UI honesta por rede via `externalIds`
resolve a visibilidade sem esse ripple.

## What this does not solve

Não corrige por que uma rede específica falha em produção — só torna a falha e seu motivo
visíveis pro usuário poder agir (reconectar, republicar). Não persiste os motivos de falha no
próprio Post (só no histórico do tick, pros posts automáticos): um publish manual segue mostrando
`failedPlatforms` só na tela de compose no momento da ação, e o card reconstrói o resultado por
`externalIds` (presença/ausência), sem o texto do motivo. Não republica automaticamente as redes
que falharam.

## References

- [_local-edr-policy-053-selecao-de-pagina-meta-e-rotulo-da-conta](053-selecao-de-pagina-meta-e-rotulo-da-conta.md) - Fix anterior no mesmo fluxo de conexão/publicação do Meta, do mesmo usuário
- [_local-edr-policy-046-historico-do-tick-de-autonomia](046-historico-do-tick-de-autonomia.md) - Histórico do tick onde a ação published-partial passa a aparecer
