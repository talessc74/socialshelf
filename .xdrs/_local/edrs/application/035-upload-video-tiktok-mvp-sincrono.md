---
name: _local-edr-policy-035-upload-de-video-para-tiktok-mvp-sincrono
description: Define a primeira fatia implementada de publicação de vídeo no TikTok — upload do próprio usuário, sem IA, sem áudio, fluxo síncrono. Use ao estender esse fluxo para geração via IA (slideshow), adicionar áudio, ou entender por que a implementação real diverge de _local-edr-policy-033.
apply-to: apps/web — upload de vídeo em /dashboard/compose; apps/api — /videos/upload, /media/tiktok-video; apps/generator — /videos/upload, /videos/signed-url; apps/publisher — TikTokPublisher
valid-from: 2026-07-08
---

# _local-edr-policy-035: Upload de Vídeo para TikTok — MVP Síncrono

## Context and Problem Statement

`_local-edr-policy-033` desenha o pipeline completo de vídeo (fila via Cloud Tasks, `VideoComposerPort` via ffmpeg, progresso por `videoStage`). Esse pipeline completo depende de peças que ainda não existem no código (geração de slideshow, mixagem de áudio, biblioteca de música) e é grande demais para entregar de uma vez com confiança.

Implementada agora apenas a fatia `videoSource: 'user-upload'` de `_local-adr-policy-036`, sem áudio (modo silêncio de `_local-adr-policy-037`), como caminho mais curto até uma publicação real no TikTok Sandbox. Este EDR documenta onde essa implementação diverge do desenho original e por quê.

## Decision Outcome

**Upload de vídeo do próprio usuário, validado no navegador, relayado em base64 (mesmo padrão de `/images/upload`), publicado de forma síncrona — sem fila, sem `VideoComposerPort`, sem áudio.**

### Details

**Por que síncrono, ao contrário de `_local-adr-policy-036`**

O modelo assíncrono da ADR-036 existe para absorver o tempo de **renderização** (ffmpeg compondo N imagens com movimento e mixando áudio) — trabalho pesado que não cabe em uma requisição HTTP. Este MVP não renderiza nada: o arquivo enviado pelo usuário é armazenado e servido como está. Sem renderização, não há o gargalo que motivou o modelo de fila — mantê-lo síncrono (mesmo padrão de `/images/upload`) é proporcional ao trabalho real realizado.

**Armazenamento — bucket reaproveitado, não um novo `socialshelf-uploads`**

`_local-adr-policy-008` previa um bucket dedicado `socialshelf-uploads`. Esta implementação reaproveita `socialshelf-generated` (prefixo `videos/{userId}/{brandId}/...`), já provisionado e com IAM já concedido ao `generator-service` (`_local-adr-policy-023`). Criar um bucket novo exigiria uma ação manual de um humano com acesso de Owner (mesmo padrão de drift já documentado em `_local-adr-policy-010`) — evitado aqui para não bloquear a entrega. Migrar para um bucket dedicado é revisão futura, não uma correção urgente.

**Domínio do vídeo servido — proxy via radiokactus.com, não o Cloud Storage direto**

`_local-adr-policy-035` assumia que uma URL assinada do Cloud Storage bastava para `PULL_FROM_URL`. Na tela real do TikTok for Developers (Content Posting API → "Verify domains"), ficou claro que **pull_by_url exige verificação de domínio** — e não é possível verificar `storage.googleapis.com` por Domain (não somos donos do domínio inteiro, é do Google, compartilhado por todos os clientes de Cloud Storage).

Solução: o vídeo é servido em `https://radiokactus.com/media/tiktok/{path}` — domínio já verificado no TikTok por `_local-adr-policy-039`. A cadeia é `apps/web` (route handler público, sem sessão de usuário) → `apps/api` (`GET /media/tiktok-video`, também público, guardas: prefixo `videos/` + token assinado com TTL, ver abaixo) → `apps/generator` (`GET /videos/signed-url`, autenticado por `INTERNAL_SECRET`) → URL assinada do GCS. Nenhuma verificação adicional no TikTok nem acesso ao Google Cloud foi necessário do usuário.

**O que isso não resolve — risco aceito conscientemente**

- Deleção automática após 7 dias (`_local-edr-policy-034`) **não está implementada** — o vídeo permanece no bucket indefinidamente até essa etapa ser construída.

**Fechado em 2026-07-09 — token assinado com expiração no proxy**

O proxy em `/media/tiktok-video` e `/media/tiktok/{path}` exige `?token=`, um HMAC-SHA256 (`path` + `exp`) assinado com `CSRF_SECRET` — mesmo segredo já compartilhado por `apps/api` e `apps/publisher` (reaproveitado em vez de introduzir um novo), mesmo formato `payload.assinatura` de `apps/api/src/lib/csrf.ts`. TTL de 2h, gerado por `apps/publisher/src/lib/mediaToken.ts` no momento em que `TikTokPublisher` resolve a URL do vídeo (`resolveTikTokVideoUrl`), verificado por `apps/api/src/lib/mediaToken.ts`. Sem token válido para o `path` exato e ainda não expirado, o proxy responde `401`. O route handler de `apps/web` apenas repassa o `token` recebido na query string — não verifica; a verificação real acontece em `apps/api`.

**Validação de duração — no navegador, não ffprepare/ffprobe no servidor**

`generator-service` não tem ffmpeg instalado (só `vips`, para imagem). Duração (3–600s, `_local-adr-policy-035`) é lida no navegador via metadados nativos do elemento `<video>` antes do upload, e revalidada em `apps/api` a partir do campo `durationSeconds` enviado pelo cliente — não há validação server-side independente do que o navegador reportou. Suficiente para uso próprio autenticado; insuficiente se o endpoint precisar resistir a um cliente adversário no futuro.

**Tamanho máximo — 25MB, não os 4GB do spec do TikTok**

Cap prático para o relay em base64 (`apps/api` → `apps/generator`, mesmo padrão de imagem) sem introduzir upload direto ao Cloud Storage (que exigiria um fluxo de URL assinada de escrita, não implementado). Vídeos maiores exigem essa extensão futura.

**`privacy_level` fixo em `SELF_ONLY`**

Apps do TikTok que não passaram pela revisão de app (nosso caso, ainda em Sandbox) só podem publicar como `SELF_ONLY` (privado, visível apenas ao autor) — publicar como público falha antes da aprovação. `TikTokPublisher` fixa esse valor; torná-lo configurável é decisão para quando o app estiver aprovado em Production.

**Confirmado em publicação real (2026-07-08) — dois requisitos que não estavam em nenhuma policy antes do teste**

1. **Verificação de domínio é por produto, não só por app.** A verificação de `radiokactus.com` feita para App details (Terms/Privacy/Website) não cobre `pull_by_url` do Content Posting API — existe uma segunda tela de "Verify domains" dentro do próprio produto (Sandbox e Production têm listas de URL properties separadas) que precisa ser verificada à parte, mesmo domínio, mesmo método (Domain/DNS TXT). Sem isso, a API devolve `403 url_ownership_unverified`.
2. **Apps não auditados só publicam em contas privadas.** Além de `privacy_level: SELF_ONLY` no post, a **conta de destino no TikTok** precisa estar configurada como privada (Configurações e privacidade → Conta privada) — sem isso, a API devolve `403 unaudited_client_can_only_post_to_private_accounts`. Não é algo que o SocialShelf controla ou pode contornar via API; é uma configuração que o dono da conta TikTok precisa fazer manualmente enquanto o app não é aprovado em Production.

Publicação real confirmada com sucesso após resolver os dois pontos acima (`publish_id` retornado pela API, formato `v_pub_url~v2-...`).

**Sem áudio**

Modo silêncio de `_local-adr-policy-037` — vídeo publicado exatamente como enviado, sem música nem narração. Multi-modo de áudio é fatia futura.

## What this does not solve

Geração de vídeo via IA (`videoSource: 'slideshow'`), `VideoComposerPort`/ffmpeg, biblioteca de música, narração TTS, fila assíncrona com `videoStage` (o desenho completo de `_local-edr-policy-033`), token assinado com expiração no proxy de mídia, e o job de deleção automática de 7 dias — nenhum desses existe ainda. Esta decisão cobre apenas a fatia mínima testável de ponta a ponta.

## References

- [_local-adr-policy-036-geracao-de-video-assincrona](../../adrs/application/036-geracao-video-multiartefato-assincrona.md) - videoSource: 'user-upload', origem desta fatia
- [_local-adr-policy-037-audio-sincronizacao-e-biblioteca-de-musica](../../adrs/application/037-audio-sincronizacao-biblioteca-musica.md) - Modo silêncio usado aqui
- [_local-adr-policy-035-tiktok-publicacao-em-multiplas-etapas](../../adrs/integration/035-tiktok-publicacao-multi-chunk.md) - Fluxo PULL_FROM_URL implementado por TikTokPublisher
- [_local-adr-policy-039-dominio-radiokactus-com-dns-e-roteamento](../../adrs/platform/039-dominio-radiokactus-dns-roteamento.md) - Domínio verificado reaproveitado pelo proxy de mídia
- [_local-edr-policy-033-pipeline-video-tiktok-implementacao](033-tiktok-video-pipeline-implementacao.md) - Desenho completo (fila, VideoComposerPort) que esta fatia não implementa ainda
- [_local-edr-policy-034-consentimento-de-terceiros-no-upload](034-consentimento-conteudo-terceiros-upload.md) - Checkbox de consentimento implementado nesta fatia; deleção de 7 dias ainda pendente
