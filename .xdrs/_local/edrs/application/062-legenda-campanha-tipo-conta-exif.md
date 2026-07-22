---
name: _local-edr-policy-062-legenda-de-campanha-por-tipo-de-conta
description: GeminiCampaignCaptionWriter ramifica o prompt por accountType (pessoal 1a pessoa sem CTA vs profissional com CTA e nome da marca) e recebe data/GPS/quantidade de fotos do item para refletir o momento real. Use ao mexer na legenda de campanha ou investigar por que o registro do texto não bate com o tipo de conta.
apply-to: apps/generator — GeminiCampaignCaptionWriter, rota /campaigns/caption-suggestion; apps/api — captionForGroup, CampaignCaptionClient
valid-from: 2026-07-22
---

# _local-edr-policy-062: Legenda de Campanha por Tipo de Conta

## Context and Problem Statement

`_local-edr-policy-048` implementou legenda por IA olhando a foto de capa, mas sem usar `accountType` (`_local-adr-policy-030`, nunca implementado até aqui) nem metadados EXIF. Usuário relatou uma conta pessoal recebendo texto em terceira pessoa com CTA ("a Fulana conseguiu chegar no destino!") — o mesmo prompt profissional aplicado a quem não é uma empresa. Como fazer a legenda refletir o tipo de conta e o momento real da foto (data, local) sem regredir o registro profissional já validado como bom pelo usuário?

## Decision Outcome

**`CampaignCaptionWriterInput` ganha `accountType`, `photoTakenAt`, `photoHasLocation` e `photoCount`; `GeminiCampaignCaptionWriter` usa dois prompts distintos por tipo de conta, ambos incluindo os metadados reais da foto.**

### Details

**Dois prompts, não um prompt com flag condicional inline**

`buildPrompt` despacha para `buildPersonalPrompt` ou `buildProfessionalPrompt` conforme `input.accountType`. Pessoal: primeira pessoa, proíbe explicitamente citar o dono em terceira pessoa e proíbe CTA/venda. Profissional: mantém o comportamento anterior (cita a marca pelo nome, pode usar CTA) — nenhuma mudança de registro para quem já validou o resultado.

**Metadados EXIF influenciam o texto sem alucinar fatos não informados**

`photoTakenAt` (data da foto, formatada em pt-BR de forma determinística — `getUTCDate`/`getUTCMonth`, nunca `Intl` dependente de timezone do runtime) e `photoHasLocation` (só a *existência* de GPS, nunca o nome de lugar) entram como uma seção "informações reais desta foto" no prompt, com instrução explícita de nunca inventar nome de cidade/estabelecimento a partir do sinal de GPS. `photoCount` avisa quando o item é um carrossel, para a legenda valer para o conjunto e não descrever só a capa.

**`accountType` resolvido no `Brand`, não no `BrandProfile`**

`GenerateCampaignTimelineUseCase` e `ExtendCampaignTimelineUseCase` buscam `accountType` via `BrandRepository.findById`, com `DEFAULT_ACCOUNT_TYPE` (`professional`) quando a marca não é encontrada — mesma tolerância de leitura já usada em outros campos adicionados depois.

## What this does not solve

Vision continua só na foto de capa do item (limitação herdada de `_local-edr-policy-048`). O switch de `accountType` (`_local-adr-policy-030`, atualização 2026-07-22) é o único lugar que decide o tipo de conta — não há por-item override.

## References

- [_local-edr-policy-048-legenda-de-campanha-por-ia](048-legenda-de-campanha-por-ia.md) - Implementação original que esta policy estende
- [_local-adr-policy-030-quota-de-marca-por-tipo-de-conta](../../adrs/application/030-quota-marca-tipo-conta.md) - accountType e o switch pessoal/profissional
- [_local-bdr-policy-009-contas-pessoal-profissional-cobranca](../../bdrs/product/009-contas-pessoal-profissional-cobranca.md) - Decisão de negócio original de contas pessoal/profissional
