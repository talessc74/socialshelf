---
name: _local-adr-policy-041-campanha-de-fotos-espinha-dorsal-fase-1
description: Fase 1 da campanha de fotos em lote — usuário sobe suas próprias fotos, o sistema agrupa por localidade/EXIF, sugere carrossel e distribui a publicação ao longo dos dias, materializando Post normais em vez de um pipeline de publicação paralelo. Use ao mexer em qualquer peça de PhotoCampaign/CampaignPhoto/CampaignItem, ou ao investigar por que um item da linha do tempo de uma campanha não foi publicado.
apply-to: packages/domain — novas entidades e ports; apps/api — clustering, upload, ativação; apps/web — /dashboard/campaigns
valid-from: 2026-07-10
---

# _local-adr-policy-041: Campanha de Fotos — Espinha Dorsal (Fase 1)

## Context and Problem Statement

O modo automático (`_local-adr-policy-040`) já publica sozinho a partir de pauta de notícia, mas o usuário trouxe um caso diferente: ele já tem as próprias fotos prontas (viagem, campanha de lançamento) e quer que o sistema paceie a publicação ao longo dos dias — sem escrever pauta, sem esperar notícia. Como estender o modo automático pra um material que o usuário traz, sem duplicar o pipeline de publicação que já existe e já é testado?

## Decision Outcome

**Uma campanha é só uma camada de planejamento (`PhotoCampaign` + `CampaignPhoto` + `CampaignItem`) que, ao ser ativada pelo usuário, materializa cada item da linha do tempo como um `Post` normal (`origin: 'campaign'`) via `PostRepository.save` — dali em diante é o mesmo pipeline de agendamento e publicação que já roda em produção, sem nenhum código de publicação novo.**

### Details

**Reaproveitar o agendador existente em vez de construir um novo**

`ScheduledPostsPoller` já roda a cada minuto (`_local-adr-policy-033`) e já publica qualquer `Post` no horário do seu `scheduledAt`. Uma campanha não precisa de nenhum scheduler novo — só precisa criar `Post`s com `scheduledAt` espalhados nos horários certos. Isso também significa que editar um item da campanha antes dele publicar é a mesma tela de "editar post agendado" que já existe em `/dashboard/scheduled`, sem UI nova.

**Carrossel de campanha reaproveita o carrossel que já existe por rede**

`MetaPublisher` (Instagram/Facebook) e `LinkedInPublisher` já publicam múltiplas imagens de um único `Post.imageStoragePaths` como carrossel. O agrupamento de fotos de uma campanha em "um item = N fotos" não precisa de nenhuma lógica de publicação nova — só precisa decidir quais fotos vão juntas antes de virar `Post`.

**X (Twitter) fica fora do seletor de redes da campanha**

`XPublisher` não publica nenhuma imagem hoje — só texto. Uma campanha de fotos com X selecionado publicaria um post sem a foto, silenciosamente incompleto. `CreatePhotoCampaignUseCase` rejeita `Platform.TWITTER` na criação da campanha; a UI nem oferece X como opção.

**Legenda inicial é um template simples, não geração por IA**

A Fase 1 prioriza o essencial (agrupar, sugerir carrossel, revisar linha do tempo, ativar) sobre a promessa completa de "storytelling automático" que o usuário levantou. A legenda inicial de cada item vem de um template com nome/descrição/palavras-chave da campanha — sem chamar Gemini — e o usuário edita cada item na tela de revisão antes de ativar. Legenda gerada por IA e o modo "storytelling entre posts" ficam para uma fase futura, quando houver mais clareza sobre o que o usuário quer nesse ponto.

## What this does not solve

Pausar/retomar uma campanha em andamento (fica pra uma fase seguinte — hoje ativar é definitivo, sem botão de pausa). Detecção de fotos duplicadas/quase-iguais (fica pra uma fase seguinte). Notificação por e-mail perto do fim da campanha (bloqueado até confirmação de credencial de um provedor de e-mail — hoje o produto não envia e-mail nenhum). Legenda automática via IA e modo "storytelling" entre posts da mesma campanha.

## References

- [_local-adr-policy-040-ativacao-do-modo-automatico-de-publicacao](040-ativacao-modo-automatico-publicacao.md) - Mesmo espírito de guardrail explícito antes de publicar sem revisão
- [_local-adr-policy-033-cloud-scheduler-wake-up-do-publisher](../platform/033-cloud-scheduler-scale-to-zero.md) - Poller reaproveitado sem alteração pela ativação da campanha
- [_local-edr-policy-039-campanha-de-fotos-implementacao-fase-1](../../edrs/application/039-campanha-de-fotos-implementacao.md) - Detalhes de implementação desta decisão
