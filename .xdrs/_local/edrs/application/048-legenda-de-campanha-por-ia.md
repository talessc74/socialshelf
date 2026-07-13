---
name: _local-edr-policy-048-legenda-de-campanha-por-ia
description: Cada item de campanha (post/carrossel) ganha legenda escrita por IA olhando de fato a foto de capa daquele item (Gemini vision) — não mais o mesmo template de texto repetido em todo post da campanha. Use ao mexer em GenerateCampaignTimelineUseCase, no novo endpoint /campaigns/caption-suggestion, ou ao investigar por que a legenda de um item de campanha não reflete a foto.
apply-to: apps/api — GenerateCampaignTimelineUseCase, CampaignCaptionClient; apps/generator — GeminiCampaignCaptionWriter, rota /campaigns/caption-suggestion
valid-from: 2026-07-13
---

# _local-edr-policy-048: Legenda de Campanha por IA

## Context and Problem Statement

`_local-edr-policy-039` deixou registrado, deliberadamente, que a legenda de cada item de campanha seria "simples, sem chamar Gemini" — um template determinístico (descrição/nome da campanha + hashtags das palavras-chave) repetido em **todo** item da campanha, mesmo cada um tendo fotos diferentes. Usuário pediu, como próximo passo já anotado no Log de Progresso, que a legenda passasse a refletir de fato a foto de cada post.

## Decision Outcome

**Cada item de campanha ganha uma chamada Gemini vision própria (não uma por campanha inteira), olhando a foto de capa daquele item — em paralelo entre itens, com fallback isolado por item para o template antigo em caso de falha.**

### Details

**Vision só na foto de capa do item, não em todas as fotos do carrossel**

Meio-termo deliberado: olhar todas as fotos de um carrossel custaria N chamadas (ou uma chamada com N imagens anexadas) por item; a foto de capa (`photoIds[0]`) já carrega o essencial da cena pra legenda fazer sentido, ao custo de 1 chamada multimodal por item — mesmo padrão de custo controlado já usado em outras decisões de IA do projeto.

**`GeminiCampaignCaptionWriter` é o primeiro writer do projeto que manda a imagem em si pro Gemini**

`CopyGeneratorPort.generateCopy` já tinha um campo `images` no input, nunca de fato usado (`GeminiCopyGenerator` só manda texto) — achado ao investigar como fazer vision funcionar aqui. Em vez de reaproveitar esse campo morto, criou-se uma porta nova e específica (`CampaignCaptionWriterPort`), pelo mesmo motivo de outras portas de propósito único no projeto (`TopicAutonomyMatcherPort`, `AutonomyBrandDiscoveryPort`): um único implementador, sem forçar um contrato genérico a carregar uma capacidade que só um caso de uso usa. O padrão de envio (`inlineData` com base64, `contents: [{role: 'user', parts: [...]}]`) já existia em `GeminiBrandDocumentExtractor` (upload de documento de marca) — reaproveitado aqui para imagem em vez de PDF/texto.

**Novo endpoint em apps/generator, não em apps/api**

Mesmo padrão arquitetural do resto do projeto: toda chamada a Gemini vive em apps/generator; apps/api chama por HTTP interno (`CampaignCaptionClient`, mesmo espírito de `GeneratorAutonomyClient` em apps/publisher). O endpoint (`POST /campaigns/caption-suggestion`) recebe `storagePath` e resolve a imagem e o `BrandProfile` (voz/negócio) ele mesmo — apps/api não baixa a foto nem lê o perfil pra isso, só encaminha IDs, mesmo padrão de `/pauta/suggest`.

**Chamadas em paralelo (`Promise.all`), não sequenciais**

`GenerateCampaignTimelineUseCase.execute` roda dentro de uma única requisição HTTP (`POST /campaigns/:id/timeline/generate`); uma campanha pode ter dezenas de itens, e uma chamada de IA por item em série multiplicaria a latência pelo número de itens. Rodar em paralelo mantém o tempo total próximo da latência de uma única chamada Gemini, ao custo de disparar N chamadas simultâneas ao generator-service — aceitável no volume atual do projeto.

**Falha de item isolada, cai pro template antigo — nunca trava a campanha inteira**

Mesmo espírito de isolamento de falha já usado no tick de autonomia (`_local-edr-policy-038`): cada chamada de legenda tem seu próprio `try/catch`; se falhar (generator-service fora do ar, foto ilegível), aquele item específico recebe o template determinístico de `_local-edr-policy-039` como fallback, e os demais itens não são afetados. O usuário sempre pode editar qualquer legenda manualmente na tela de revisão antes de ativar — a IA nunca é a única chance de acerto.

## What this does not solve

Vision só na foto de capa — carrosséis onde a narrativa depende das fotos seguintes (não só a primeira) não têm isso refletido na legenda. Sem uso de EXIF/GPS na legenda (data, localização aproximada) — só o conteúdo visual da capa e o contexto textual da campanha. Sem opção de desligar a legenda por IA e voltar ao template fixo por escolha do usuário — hoje é sempre-ligado, com fallback automático só em caso de erro técnico.

## References

- [_local-edr-policy-039-campanha-de-fotos-implementacao-fase-1](039-campanha-de-fotos-implementacao.md) - Decisão original da legenda como template simples, "fase futura" que esta policy implementa
- [_local-edr-policy-038-tick-de-autonomia-implementacao](038-tick-autonomia-implementacao.md) - Mesmo padrão de isolamento de falha por item/marca reaproveitado aqui
