---
name: _local-edr-policy-066-proporcao-incompativel-com-instagram
description: media_publish do Instagram rejeitava "The aspect ratio is not supported" pra uma foto panorâmica de campanha (iPhone), sem retry possível — não é uma corrida temporária, é a Graph API recusando de vez uma proporção fora de 4:5–1.91:1. Aspect ratio calculado no upload (sharp, só cabeçalho); GenerateCampaignTimelineUseCase/ExtendCampaignTimelineUseCase excluem fotos fora do intervalo de qualquer carrossel só quando a campanha inclui Instagram, mesma filosofia do pool de quase-iguais (nada é descartado). Use ao mexer em UploadCampaignPhotoUseCase, Generate/ExtendCampaignTimelineUseCase, ou na tela de revisão da linha do tempo.
apply-to: apps/generator — imageAspectRatio.ts, /images/upload; apps/api — UploadCampaignPhotoUseCase, unsupportedAspectRatio.ts, aspectRatioMarks.ts, Generate/ExtendCampaignTimelineUseCase; apps/web — dashboard/campaigns/[id]/timeline/page.tsx; packages/domain — CampaignPhoto
valid-from: 2026-07-24
---

# _local-edr-policy-066: Proporção incompatível com Instagram

## Context and Problem Statement

Usuário reportou (com print) um post de campanha que falhava ao publicar no Instagram:

```
Instagram carousel item container failed: The aspect ratio is not supported.
```

A foto era um panorama tirado no iPhone — muito mais larga que alta. A Graph API do
Instagram só aceita fotos de feed/carrossel entre 4:5 (retrato) e 1.91:1 (paisagem);
fora disso, o container é rejeitado de vez. Diferente da corrida "Media ID is not
available" já documentada em `_local-edr-policy-058`, aqui não há nada pra esperar —
clicar em "Tentar novamente" falharia com o mesmo erro pra sempre, porque a imagem em
si nunca muda. Essa lacuna já estava registrada como pendência em
`_local-edr-policy-060` ("não resolve... o bug reportado à parte de 'aspect ratio não
suportado'").

Perguntado como preferia resolver, o usuário comparou explicitamente ao tratamento já
existente para fotos quase-iguais (`_local-edr-policy-063`): detectar o problema e
colocar a foto na lista de "não utilizadas", em vez de deixá-la travar um post.

## Decision Outcome

**Proporção calculada no upload; fotos fora do intervalo aceito pelo Instagram nunca
entram num carrossel quando a campanha inclui essa rede — ficam de fora e aparecem na
tela de revisão, mesma filosofia do pool de quase-iguais.**

### Details

**Cálculo no upload, não em cada publish**

`computeAspectRatio` (novo, `apps/generator/src/lib/imageAspectRatio.ts`) usa
`sharp(buffer).metadata()` — lê só o cabeçalho da imagem, não decodifica pixels,
mesmo custo desprezível de `computePerceptualHash`. Calculado junto no mesmo request
`/images/upload` que já computa o hash perceptual (mesmo flag, sem novo parâmetro na
API). `CampaignPhoto` ganha `aspectRatio: number | null` (raw, null quando o sharp não
decodifica — nunca tratado como incompatível sem o dado real, mesma filosofia do
`perceptualHash` null).

**Exclusão só quando a campanha inclui Instagram**

`splitByAspectRatioSupport(photos, platforms)` só filtra quando `platforms` inclui
`Platform.INSTAGRAM` — Facebook e LinkedIn aceitam qualquer proporção razoável, então
uma campanha sem Instagram nunca perde foto nenhuma por causa disso. Fotos com
`aspectRatio: null` nunca são excluídas, mesmo numa campanha com Instagram.

**Marcação persistida, mesmo padrão do `duplicateOfPhotoId`**

`CampaignPhoto.unsupportedAspectRatio: boolean` é computado e persistido por
`applyAspectRatioMarks` dentro de `GenerateCampaignTimelineUseCase` e
`ExtendCampaignTimelineUseCase` — não é recalculado no cliente. Web só lê o campo já
pronto, do mesmo jeito que já lê `duplicateOfPhotoId` sem reimplementar a distância de
Hamming. Fotos excluídas somem de qualquer carrossel novo mas continuam na campanha —
nunca apagadas.

**Nova seção na revisão, gêmea do pool de quase-iguais**

"Fotos com formato incompatível com o Instagram" em
`dashboard/campaigns/[id]/timeline/page.tsx`, ao lado (não dentro) de "Fotos quase
iguais deixadas de fora" — são dois motivos de exclusão diferentes, cada um com sua
própria seção, mas a mesma linguagem visual (miniatura opaca, rótulo "de fora").

**Campanha sem fotos compatíveis: erro explícito, nunca timeline vazia em silêncio**

Se depois do filtro não sobrar nenhuma foto suportada, `GenerateCampaignTimelineUseCase`
e `ExtendCampaignTimelineUseCase` lançam erro explícito em vez de gerar/estender com
zero itens — evita uma campanha "reviewing" ou "active" sem nenhum post agendado e sem
explicação.

## What this does not solve

Não corrige retroativamente um post já materializado com a foto panorâmica dentro —
essa correção vale só pra próximas chamadas de Generate/ExtendCampaignTimelineUseCase.
Um post que já falhou com esse erro antes desta correção precisa ser editado (tirar a
foto) ou descartado manualmente; "Tentar novamente" nele continua falhando. Não
corrige nem recorta a foto pra caber no intervalo aceito — só a exclui do carrossel;
cortar/padronizar a imagem automaticamente ficou fora de escopo (o usuário optou pelo
mesmo tratamento das quase-iguais, não por correção automática de imagem).

## References

- [_local-edr-policy-058-retry-em-media-nao-pronta-do-instagram](058-retry-instagram-media-nao-pronta.md) - Outra falha de publish do Instagram, mas uma corrida temporária (retry ajuda); esta aqui é permanente (retry não ajuda)
- [_local-edr-policy-060-confiabilidade-de-publicacao-no-instagram](060-confiabilidade-publicacao-e-metricas-instagram.md) - Registrou esta lacuna como pendência, junto de outras falhas de confiabilidade do Instagram
- [_local-edr-policy-063-deteccao-fotos-quase-iguais](063-deteccao-fotos-quase-iguais.md) - Padrão de exclusão (campo persistido + pool na revisão) que este EDR replica pra um motivo de exclusão diferente
