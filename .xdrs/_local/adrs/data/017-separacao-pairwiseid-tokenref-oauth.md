---
name: _local-adr-policy-017-separacao-pairwiseid-e-tokenref-oauth
description: Define a separação entre PairwiseId (identidade rastreável) e TokenRef (referência de vault) nas conexões OAuth. Use ao modelar, ler ou escrever dados de OAuthConnection.
apply-to: packages/domain e apps/api — OAuthConnection e token_vault
valid-from: 2026-06-16
---

# _local-adr-policy-017: Separação PairwiseId e TokenRef OAuth

## Context and Problem Statement

Uma conexão OAuth entre usuário e plataforma precisa de dois identificadores distintos com propósitos diferentes: um para identificar o usuário naquela plataforma de forma consistente (sem vazar a identidade real), outro para localizar o token no vault de forma revogável.

Usar o mesmo identificador para os dois propósitos cria acoplamento — revogar um token exigiria conhecer a identidade da plataforma, e o ID de rastreamento ficaria exposto como chave de dado sensível.

Como separar identidade rastreável de referência de segredo?

## Decision Outcome

**PairwiseId para identidade; TokenRef para localização de vault — dois campos, dois propósitos**

```typescript
interface OAuthConnection {
  id: string           // ID interno da conexão
  pairwiseId: string   // SHA256(userId:platform).slice(0,32)
  tokenRef: string     // referência aleatória para doc em token_vault
  platform: Platform
  brandId: string
  // ...
}
```

### Details

**PairwiseId**

- Derivação: `SHA256(userId + ':' + platform).digest('hex').slice(0, 32)`
- Determinístico: o mesmo usuário na mesma plataforma sempre gera o mesmo pairwiseId
- Uso: chave de documento em `oauth_connections/{pairwiseId}` — garante unicidade e deduplicação
- Privacidade: não é o ID real da plataforma — não permite rastreamento cruzado entre plataformas (ADR-007)
- Indexado no Firestore para lookups por `(brandId, pairwiseId)`

**TokenRef**

- Derivação: string aleatória gerada no momento do armazenamento
- Não determinístico: muda a cada novo armazenamento de token
- Uso: chave do documento em `token_vault/{tokenRef}` — localiza o blob criptografado
- Revogação: delete de `token_vault/{tokenRef}` é independente de conhecer pairwiseId ou platform ID
- Não indexado — acesso sempre por chave direta

**Separação de responsabilidades**

| Campo | Pergunta que responde | Exposto ao cliente? |
|---|---|---|
| `pairwiseId` | "Quem é este usuário nesta plataforma?" | Sim (leitura via Firestore rules) |
| `tokenRef` | "Onde está o token deste usuário?" | Não (token_vault sem acesso cliente) |

## References

- [_local-adr-policy-007-identidade-pairwise-e-consentimento](../controls/007-pairwise-identity-consent.md) - Modelo de identidade pairwise por plataforma
- [_local-adr-policy-012-token-vault-criptografia-aes-256-gcm](../controls/012-token-vault-encryption.md) - Criptografia do conteúdo em token_vault
- [_local-adr-policy-015-firestore-security-rules-implicit-deny](../controls/015-firestore-security-rules.md) - token_vault inacessível ao cliente
