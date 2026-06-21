---
name: _local-adr-policy-016-refresh-de-token-oauth-por-plataforma
description: Define a estratégia de refresh de tokens OAuth por plataforma. Use ao implementar publicação ou ao avaliar vida útil de tokens de uma plataforma conectada.
apply-to: apps/publisher — XPublisher, LinkedInPublisher, MetaPublisher
valid-from: 2026-06-16
---

# _local-adr-policy-016: Refresh de Token OAuth por Plataforma

## Context and Problem Statement

Tokens OAuth de acesso têm vida útil limitada. Cada plataforma tem políticas distintas de expiração e refresh. Uma estratégia única de refresh para todas as plataformas não é viável — a implementação deve ser adaptada à realidade de cada API.

Como gerenciar a expiração e renovação de tokens OAuth sem forçar o usuário a reconectar desnecessariamente?

## Decision Outcome

**Refresh automático apenas para X (Twitter); LinkedIn e Meta dependem de tokens de longa duração**

Cada plataforma tem uma estratégia explícita — a ausência de refresh em LinkedIn e Meta é decisão, não omissão.

### Details

**X (Twitter) — refresh automático**

- `refresh_token` armazenado junto com `access_token` no `token_vault`
- No 401: `XPublisher` tenta um refresh via `refreshXToken()` e re-tenta a publicação
- Se o refresh falhar: erro propagado ao use-case — usuário precisa reconectar
- `refresh_token` rotacionado a cada uso e atualizado no vault

**LinkedIn — tokens de longa duração**

- Access tokens do LinkedIn têm validade de 60 dias
- Não existe endpoint de refresh na LinkedIn API v2 para o escopo usado
- Estratégia: detectar 401 e retornar erro ao usuário para reconexão manual
- `LinkedInPublisher` não implementa refresh — comportamento explícito

**Meta (Instagram/Facebook) — tokens de longa duração**

- Tokens de usuário do Meta Graph API têm validade de 60 dias
- Meta oferece endpoint de refresh, mas exige troca explícita com `client_secret`
- Estratégia atual: detectar 401 e retornar erro ao usuário para reconexão manual
- `MetaPublisher` não implementa refresh — comportamento explícito
- Refresh automático do Meta é candidato a implementação futura se a taxa de expiração for problema em produção

**Comportamento comum**

Em caso de falha de autenticação (401) sem refresh disponível, o erro retornado ao frontend deve informar ao usuário que a conexão com a plataforma expirou e solicitar reconexão via OAuth.

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
