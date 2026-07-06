---
name: _local-edr-policy-034-consentimento-de-terceiros-no-upload
description: Define o mecanismo de consentimento exigido antes do upload de vídeo próprio do usuário para geração de conteúdo TikTok. Use ao implementar a tela de upload de vídeo em /dashboard/generate ou a validação correspondente na API.
apply-to: apps/web — upload de vídeo em /dashboard/generate; apps/api — validação de upload
valid-from: 2026-07-06
---

# _local-edr-policy-034: Consentimento de Terceiros no Upload

## Context and Problem Statement

Vídeo enviado pelo próprio usuário (`videoSource: 'user-upload'`, [_local-adr-policy-036](../../adrs/application/036-geracao-video-multiartefato-assincrona.md)) é uma categoria de dado nova: pode conter rosto, voz ou conteúdo de terceiros que não são o dono da conta SocialShelf. Diferente de imagem gerada por IA (conteúdo original do sistema), esse upload transfere responsabilidade de direito de uso para quem envia. Sem consentimento explícito capturado no momento do upload, o SocialShelf não tem registro de que o usuário declarou ter esse direito.

## Decision Outcome

**Checkbox de consentimento obrigatório no momento do upload, com texto direto — detalhamento jurídico completo fica nos Termos de Uso, não no componente de upload.**

### Details

**Texto do checkbox**

Consentimento simples e direto, apresentado no momento do upload, antes do arquivo ser aceito para processamento:

> "Confirmo que tenho os direitos necessários sobre este vídeo e sobre as pessoas nele, e autorizo seu uso para publicação no TikTok."

**Sem checkbox marcado, sem upload**

O botão de envio permanece desabilitado até o checkbox ser marcado — mesmo padrão de affordance já esperado pela Galera de UX (COMPASS) na deliberação de origem: a restrição é visível antes da tentativa, não um erro depois de tentar enviar.

**Persistência do consentimento**

O aceite é registrado com `userId`, `timestamp` e referência ao `GenerationRequest`/upload correspondente — não é apenas um estado de UI descartado após o envio. Isso dá rastreabilidade caso a origem do direito de uso precise ser verificada depois.

**Detalhamento jurídico**

O texto completo de responsabilidade sobre conteúdo de terceiros, uso indevido e consequências de violação de TOS de plataformas de destino fica nos Termos de Uso do SocialShelf — o checkbox no fluxo de upload referencia os Termos, não os reproduz.

**Retenção do vídeo bruto**

O vídeo enviado é mantido por 7 dias após a publicação, com opção de download pelo usuário durante esse período, e então deletado — atualização de [_local-adr-policy-008-retencao-e-privacidade-de-dados](../../adrs/data/008-data-retention-privacy.md). A exclusão ao final do prazo é uma etapa monitorada (job agendado com alerta em caso de falha de execução), não uma limpeza assumida.

## References

- [_local-adr-policy-036-geracao-de-video-assincrona](../../adrs/application/036-geracao-video-multiartefato-assincrona.md) - Origem do upload de vídeo próprio do usuário
- [_local-adr-policy-008-retencao-e-privacidade-de-dados](../../adrs/data/008-data-retention-privacy.md) - Retenção de 7 dias atualizada por este EDR
- [_local-adr-policy-007-identidade-pairwise-e-consentimento](../../adrs/controls/007-pairwise-identity-consent.md) - Consentimento explícito como pré-requisito, princípio já estabelecido para dados de conexão OAuth
