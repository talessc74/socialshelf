---
name: _local-adr-policy-024-instagram-publicacao-em-duas-etapas
description: Define o fluxo obrigatório de duas chamadas para publicação no Instagram via Meta Graph API. Use ao implementar ou depurar publicação de conteúdo no Instagram.
apply-to: apps/publisher — MetaPublisher
valid-from: 2026-06-16
---

# _local-adr-policy-024: Instagram — Publicação em Duas Etapas

## Context and Problem Statement

A Meta Graph API para Instagram não permite publicar conteúdo em uma única chamada de API. O processo é dividido em duas etapas obrigatórias pela plataforma: criação de container de mídia e publicação do container.

Como implementar publicação no Instagram respeitando o fluxo obrigatório da Meta Graph API?

## Decision Outcome

**Duas chamadas sequenciais: criação de container de mídia seguida de publicação do container**

Este é um requisito da Meta Graph API — não uma escolha de design do SocialShelf.

### Details

**Etapa 1 — Criação do container de mídia**

```
POST /{igAccountId}/media
  ?image_url={url}        ← URL pública da imagem (obrigatório para posts com imagem)
  &caption={text}         ← legenda do post
  &access_token={token}
```

Resposta: `{ id: string }` — este é o `containerId`

**Etapa 2 — Publicação do container**

```
POST /{igAccountId}/media_publish
  ?creation_id={containerId}
  &access_token={token}
```

Resposta: `{ id: string }` — ID do post publicado no Instagram

**Implementação no MetaPublisher**

`MetaPublisher.publishToInstagram()` executa as duas chamadas sequencialmente. Falha na etapa 1 aborta o fluxo sem tentar a etapa 2. Falha na etapa 2 após container criado é registrada com o `containerId` para diagnóstico.

**Facebook vs Instagram**

Publicação no Facebook (via Meta Graph API) usa endpoint diferente e fluxo de uma etapa. `MetaPublisher` tem caminhos de código separados para `publishToInstagram()` e `publishToFacebook()`.

**Requisito de HTTPS para a URL da imagem**

A URL da imagem enviada na etapa 1 deve ser publicamente acessível via HTTPS. URLs locais ou de desenvolvimento não funcionam. Este é um requisito Meta — sem exceções.

## References

- [_local-adr-policy-009-oauth-exclusivo-redes-sociais](009-oauth-social-networks.md) - OAuth como modelo de acesso à Meta Graph API
- [_local-adr-policy-016-refresh-de-token-oauth-por-plataforma](016-refresh-token-oauth.md) - Estratégia de refresh de token para Meta
- [_local-bdr-policy-003-redes-sociais-suportadas](../../bdrs/product/003-redes-sociais-suportadas.md) - Status de integração do Instagram
