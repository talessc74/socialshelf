---
name: _local-adr-policy-016-refresh-de-token-oauth-por-plataforma
description: Define a estratégia de refresh de tokens OAuth por plataforma. Use ao implementar publicação ou ao avaliar vida útil de tokens de uma plataforma conectada.
apply-to: apps/publisher — XPublisher, LinkedInPublisher, MetaPublisher, XAnalyticsReader, LinkedInAnalyticsReader, RefreshMetaConnectionsUseCase
valid-from: 2026-06-16
---

# _local-adr-policy-016: Refresh de Token OAuth por Plataforma

## Context and Problem Statement

Tokens OAuth de acesso têm vida útil limitada. Cada plataforma tem políticas distintas de expiração e refresh. Uma estratégia única de refresh para todas as plataformas não é viável — a implementação deve ser adaptada à realidade de cada API.

Como gerenciar a expiração e renovação de tokens OAuth sem forçar o usuário a reconectar desnecessariamente?

## Decision Outcome

**Refresh automático em todas as plataformas — reativo (401) para X, LinkedIn e TikTok; proativo (job agendado) para Meta**

Cada plataforma tem uma estratégia explícita, adaptada à forma como sua API trata o refresh.

### Details

**X (Twitter) — refresh automático reativo**

- `refresh_token` armazenado junto com `access_token` no `token_vault`
- No 401: `XPublisher`/`XAnalyticsReader` tentam um refresh via `refreshXToken()` (lib compartilhada, `apps/publisher/src/lib/x-refresh.ts`) e re-tentam a chamada
- Se o refresh falhar: erro propagado ao use-case — usuário precisa reconectar
- `refresh_token` rotacionado a cada uso e atualizado no vault

**TikTok — refresh automático reativo**

- Mesmo padrão de X: `TikTokPublisher` tenta refresh no 401 (`refresh_token` de ~1 ano, access_token de 24h — ADR-034)

**LinkedIn — refresh automático reativo (antes: tokens de longa duração sem refresh)**

- Access tokens do LinkedIn têm validade de 60 dias; `refresh_token` (90 dias) já era gravado no vault desde a conexão inicial (`HandleLinkedInCallbackUseCase`), mas nunca usado
- `LinkedInPublisher`/`LinkedInAnalyticsReader` agora usam `refreshLinkedInToken()` (`apps/publisher/src/lib/linkedin-refresh.ts`): `LinkedInPublisher` faz um refresh **proativo** antes de iniciar o fluxo de publicação quando `connection.expiresAt` já passou (evita re-subir imagens por causa de um 401 a meio do fluxo encadeado de upload), mais uma defesa reativa no 401 final; `LinkedInAnalyticsReader` é puramente reativo (401 → refresh → retry), já que é uma única chamada
- Se o refresh falhar (refresh_token também expirado/revogado): erro propagado — usuário precisa reconectar

**Meta (Instagram/Facebook) — refresh automático proativo (antes: tokens de longa duração sem refresh)**

- Tokens de usuário do Meta Graph API (Facebook Login) e o token do Login do Instagram direto têm validade de 60 dias
- Diferente de X/LinkedIn/TikTok, a Meta não separa `access_token` de `refresh_token` — só é possível trocar um token **ainda válido** por um novo (`fb_exchange_token` para o fluxo via Página; `ig_refresh_token` para o Login do Instagram direto). Depois de expirado de vez, não há recuperação possível, só reconexão manual. Por isso refresh reativo-no-401 (como em X/LinkedIn/TikTok) não funciona aqui — o token já estaria irrecuperável quando a falha aparecesse
- Estratégia: `RefreshMetaConnectionsUseCase` (`apps/publisher/src/use-cases/`), acionado uma vez por dia pelo Cloud Scheduler via `POST /internal/oauth-token-refresh-tick` (`publisher-oauth-token-refresh-tick`, `.github/workflows/deploy.yml`). Busca todas as conexões Facebook/Instagram (`OAuthRepository.findAllByPlatforms`) com `expiresAt` a 10 dias ou menos do vencimento e renova cada uma: via Página (`refreshMetaUserToken` + `fetchMetaPages`, reconstruindo também o `page_access_token`) ou via Login do Instagram direto (`refreshInstagramLoginToken`), conforme o `auth_kind` gravado no vault
- Falha de refresh de uma conexão (ex.: token já irrecuperavelmente expirado) é registrada em log estruturado e não interrompe o processamento das demais conexões da varredura; a conexão falha permanece quebrada até reconexão manual — mesmo comportamento final de antes desta mudança, só que agora é a exceção, não a regra
- `MetaPublisher`/`MetaAnalyticsReader` continuam sem refresh reativo próprio — dependem inteiramente do job proativo manter o token sempre renovado bem antes do vencimento

**Comportamento comum**

Em caso de falha de autenticação sem refresh disponível ou sem refresh possível (refresh_token/token ausente, revogado, ou já expirado de vez), o erro retornado ao frontend deve informar ao usuário que a conexão com a plataforma expirou e solicitar reconexão via OAuth.

### 2026-11-22 — refresh automático para Meta e LinkedIn

Usuário reportou falha real em produção: métricas do Instagram pararam de carregar com
`Error validating access token: Session has expired` — o token de usuário (60 dias) conectado
há mais de 60 dias nunca foi renovado, porque nada no sistema lia `OAuthConnection.expiresAt`
nem acionava qualquer refresh para Meta. A ausência de refresh documentada aqui desde
2026-06-16 como "decisão, não omissão" havia inclusive previsto esta exata condição de
gatilho ("candidato a implementação futura se a taxa de expiração for problema em produção").

Investigação revelou que X e TikTok já se recuperavam sozinhos (reativo no 401), mas LinkedIn
tinha `refresh_token` gravado e nunca usado, e Meta não tinha nenhum mecanismo. Correção:
refresh reativo para LinkedIn (mesmo padrão de X/TikTok) e um job agendado proativo novo para
Meta, já que seu modelo de token não sobrevive a uma falha reativa (ver Details acima).

A conta do Instagram afetada por este incidente específico precisa, ainda assim, de reconexão
manual única via Central de Contas — o token dela já expirou de vez antes desta correção
existir, e não há como um refresh recuperar um token já irrecuperavelmente expirado (só
reconexão via OAuth). O job agendado novo previne a recorrência, não desfaz o incidente já
ocorrido.

### 2026-06-21 — correção: saneamento de expires_in implausível (Meta)

Usuário reportou falha ao conectar/reconectar Instagram: callback retornava
`?error=oauth_failed&detail=Invalid time value`. Causa raiz: `HandleMetaCallbackUseCase`
calculava `expiresAt = new Date(Date.now() + expires_in * 1000)` confiando apenas em
`typeof === 'number' && Number.isFinite(...)` para validar `expires_in` vindo da Meta.
Um valor implausível (ausente, zero, negativo ou fora de uma faixa razoável) produzia
uma `Date` inválida, e `expiresAt.toISOString()` lançava `RangeError: Invalid time value`
ao serializar para o token vault / Firestore — quebrando a conexão de Facebook e Instagram
nesse fluxo.

Correção: validar que `expires_in` é finito, positivo e não excede um teto de 1 ano antes
de usá-lo; caso contrário, aplicar o fallback de 60 dias já existente. Adicionalmente,
após construir a `Date`, verificar `Number.isNaN(expiresAt.getTime())` e reaplicar o
fallback se ainda assim resultar em data inválida — uma segunda camada de defesa contra
qualquer valor anômalo que a Meta venha a retornar.

## References

- [_local-adr-policy-009-oauth-exclusivo-redes-sociais](009-oauth-social-networks.md) - OAuth como único modelo de integração
- [_local-adr-policy-012-token-vault-criptografia-aes-256-gcm](../controls/012-token-vault-encryption.md) - Armazenamento seguro do refresh_token
