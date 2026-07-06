---
name: _local-adr-policy-035-tiktok-publicacao-em-multiplas-etapas
description: Define o fluxo de publicação de vídeo no TikTok via Content Posting API — inicialização, envio do arquivo e consulta de status. Use ao implementar ou depurar TikTokPublisher.
apply-to: apps/publisher — TikTokPublisher
valid-from: 2026-07-06
---

# _local-adr-policy-035: TikTok — Publicação em Múltiplas Etapas

## Context and Problem Statement

Assim como a Meta Graph API exige duas chamadas para publicar no Instagram ([_local-adr-policy-024](024-instagram-publicacao-duas-etapas.md)), a Content Posting API do TikTok exige um fluxo de múltiplas etapas: inicialização (`/v2/post/publish/video/init/`), envio do arquivo de vídeo e consulta de status até conclusão. O envio do arquivo pode ocorrer por upload direto em chunks (`FILE_UPLOAD`) ou por referência a uma URL pública (`PULL_FROM_URL`).

Como implementar a publicação no TikTok respeitando o fluxo obrigatório da API, sem reimplementar lógica de chunking desnecessária dado que o vídeo já vive no Cloud Storage do SocialShelf?

## Decision Outcome

**`PULL_FROM_URL` como estratégia única — o TikTok busca o vídeo via URL HTTPS pública do Cloud Storage, sem o SocialShelf implementar upload em chunks**

Mesmo princípio já estabelecido para Instagram (ADR-024: `image_url` pública, sem chunking client-side) aplicado ao TikTok. Isso evita implementar e testar a lógica de chunk de 5-64MB / até 1000 chunks documentada pela API — responsabilidade transferida ao TikTok, que já busca o arquivo pela URL.

### Details

**Etapa 1 — Inicialização**

```
POST /v2/post/publish/video/init/
{
  "post_info": { "title": "...", "privacy_level": "...", "disable_duet": bool, "disable_comment": bool, "disable_stitch": bool },
  "source_info": { "source": "PULL_FROM_URL", "video_url": "https://storage.googleapis.com/..." }
}
```

Resposta inclui `publish_id`, usado na consulta de status.

**Etapa 2 — Consulta de status**

`TikTokPublisher` faz polling do status de processamento do `publish_id` até `PUBLISH_COMPLETE` ou estado de falha — mesmo padrão de polling já usado pelo cliente do SocialShelf para `GenerationRequest` (ADR-019), aplicado agora do lado do `publisher` em vez do cliente web.

**Requisito de HTTPS pública**

A URL do vídeo enviada na inicialização deve ser publicamente acessível via HTTPS — mesmo requisito documentado para Instagram em ADR-024. URLs assinadas do Cloud Storage com expiração suficiente para a janela de processamento do TikTok atendem esse requisito.

**Validação de spec antes de tentar publicar**

Antes de chamar a API do TikTok, o vídeo é validado contra os limites documentados: formato (MP4 ou WebM), duração (3–600 segundos), tamanho (até 4GB). Vídeo fora desses limites não gera tentativa de publicação — mesmo princípio de ADR-018 (validação de limite de caracteres antes de persistir draft): falha detectada antes da chamada externa, nunca depois.

**Rate limiting**

A API de inicialização tem limite de 6 requisições por minuto por token de acesso do usuário. Como a publicação já passa pelo `publisher-service` (acionado por post agendado ou publicação imediata, nunca em lote síncrono do usuário), esse limite não é esperado como gargalo prático — mas `TikTokPublisher` implementa backoff exponencial em caso de 429, mesmo padrão de resiliência esperado de qualquer chamada a API externa.

**Falha após publish_id emitido**

Se o vídeo foi inicializado (publish_id emitido) mas o processamento falha do lado do TikTok, o `Post` transita para `failed` (ADR-018) com o `publish_id` registrado para diagnóstico — mesmo padrão do `containerId` em falha parcial do Instagram (ADR-024).

## What this does not solve

Verificação de disponibilidade/suporte real de `PULL_FROM_URL` contra a documentação vigente da TikTok API deve ser confirmada na implementação — esta decisão assume que o método está disponível para o tipo de app do SocialShelf; se não estiver, `FILE_UPLOAD` em chunks é o fallback documentado pela API e exige nova decisão de implementação (chunking client-side).

## References

- [_local-adr-policy-024-instagram-publicacao-em-duas-etapas](024-instagram-publicacao-duas-etapas.md) - Precedente de publicação multi-etapa via URL pública
- [_local-adr-policy-034-tiktok-oauth-identificadores-pairwise](034-tiktok-oauth-identificadores.md) - Modelo OAuth e token usado nesta publicação
- [_local-adr-policy-018-post-maquina-de-estados-de-publicacao](../application/018-post-state-machine.md) - Estados published/failed usados no resultado desta publicação
