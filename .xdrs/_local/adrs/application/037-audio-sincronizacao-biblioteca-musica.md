---
name: _local-adr-policy-037-audio-sincronizacao-e-biblioteca-de-musica
description: Define o modelo de sincronização entre áudio e duração de vídeo, e a estratégia de biblioteca de música própria do sistema. Use ao implementar a etapa de áudio do VideoComposerPort ou o seletor de estilo de música no front-end.
apply-to: apps/generator — composição de áudio; apps/web — seletor de áudio em /dashboard/generate
valid-from: 2026-07-06
---

# _local-adr-policy-037: Áudio — Sincronização e Biblioteca de Música

## Context and Problem Statement

[_local-adr-policy-036-geracao-de-video-assincrona](036-geracao-video-multiartefato-assincrona.md) permite que um vídeo TikTok tenha narração, música de fundo ou silêncio. Narração e música têm naturezas diferentes: narração é gerada a partir do conteúdo textual (duração variável, imprevisível antes da geração), música é um recurso de biblioteca (duração fixa, conhecida). Sem um modelo explícito de sincronização, a duração final do vídeo fica ambígua.

Como determinar a duração final do vídeo quando ela depende de uma trilha de áudio, e como a música de fundo deve ser servida sem introduzir dependência em API de terceiro?

## Decision Outcome

**A trilha dita a duração quando é narração; o vídeo dita a duração quando é música ou silêncio. Biblioteca de música própria, hospedada pelo SocialShelf — usuário escolhe estilo, não faixa individual.**

### Details

**Modelo de sincronização por modo de áudio**

| Modo | Quem dita a duração final | Comportamento |
|---|---|---|
| Narração (TTS) | A narração | Duração total do vídeo = duração do áudio gerado. Tempo de cada slide é distribuído proporcionalmente entre as posições do slideshow. |
| Música | O vídeo | Duração do vídeo segue o modelo de slides (duração padrão por slide × `artifactCount`, ou duração do vídeo enviado pelo usuário). Música é cortada para caber, com fade-out nos últimos segundos antes do fim. |
| Silêncio | O vídeo | Mesmo modelo de duração por slide da música, sem trilha. |

**Duração padrão por slide**

Quando o vídeo não é ditado por narração, cada slide do slideshow tem duração padrão de 3 segundos — mesmo valor usado como ponto de partida, ajustável em fase futura se validação com usuário real (conforme recomendação de EMPIRICUS na deliberação) indicar necessidade de mudança. Vídeo enviado pelo próprio usuário (`videoSource: 'user-upload'`) usa a duração nativa do arquivo, sem ajuste de slide.

**Narração — texto de origem**

O texto narrado é derivado da copy/headline já gerada pelo pipeline existente ([_local-adr-policy-028](028-geracao-multiartefato.md)) — não é um campo de texto livre adicional que o usuário digita. Isso evita nova superfície de input e mantém a narração consistente com a legenda publicada.

**Biblioteca de música — recurso próprio, catálogo fechado**

Seguindo o mesmo espírito de catálogo fechado já estabelecido para `TemplateStyle` ([_local-adr-policy-031-template-texto-sobre-imagem](031-template-texto-sobre-imagem.md)): um pequeno conjunto de estilos/faixas (ex: "upbeat", "corporate", "calmo"), hospedado no Cloud Storage do próprio SocialShelf — não um provedor terceirizado de música com sua própria API e modelo de dados. Usuário escolhe o **estilo**, não uma faixa específica de um catálogo extenso — evolução do catálogo é decisão de fase futura.

Cada faixa do catálogo precisa ter status de licenciamento documentado e verificado antes de entrar no catálogo. Seguindo o precedente de revisão periódica já estabelecido por [_local-adr-policy-032-monitoramento-versao-api-linkedin](../integration/032-monitoramento-versao-api-linkedin.md), o status de licenciamento de cada faixa é reverificado em cadência trimestral — licenciamento não é uma verificação única e permanente.

**Fade-out**

Quando o modo é música, os últimos ~3 segundos do vídeo aplicam redução progressiva de volume até zero, sincronizados com o fim do vídeo — nunca um corte abrupto.

## What this does not solve

Provedor de TTS (ex: Google Cloud Text-to-Speech, dado que o projeto já depende de Vertex AI/GCP) é decisão de implementação a confirmar no EDR correspondente, não fixada aqui como arquitetura. Customização de faixa de música por marca (upload próprio de música pelo usuário) não é coberta — está fora de escopo desta fase.

## References

- [_local-adr-policy-036-geracao-de-video-assincrona](036-geracao-video-multiartefato-assincrona.md) - Pipeline de vídeo que consome este modelo de áudio
- [_local-adr-policy-031-template-texto-sobre-imagem](031-template-texto-sobre-imagem.md) - Precedente de catálogo fechado de estilo
- [_local-adr-policy-032-monitoramento-versao-api-linkedin](../integration/032-monitoramento-versao-api-linkedin.md) - Precedente de revisão periódica agendada
