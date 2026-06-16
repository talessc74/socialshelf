---
name: _local-adr-policy-012-token-vault-criptografia-aes-256-gcm
description: Define o esquema de criptografia de tokens OAuth no Firestore. Use ao modificar o armazenamento de tokens, rotação de chave ou troca de backend de vault.
apply-to: apps/api e apps/publisher — FirestoreTokenVault
valid-from: 2026-06-16
---

# _local-adr-policy-012: Token Vault — Criptografia AES-256-GCM

## Context and Problem Statement

Tokens OAuth de redes sociais são credenciais de alta sensibilidade. Armazená-los em Firestore sem proteção adicional expõe o dado caso a coleção `token_vault` seja acessada indevidamente — por erro de rules, comprometimento de conta GCP ou acesso privilegiado não autorizado.

Como armazenar tokens OAuth no Firestore garantindo confidencialidade e integridade do dado em repouso?

## Decision Outcome

**AES-256-GCM com derivação de chave via SHA-256 do CSRF_SECRET**

Cada token é criptografado no momento do armazenamento e descriptografado no momento do uso. A chave de criptografia é derivada de `CSRF_SECRET` e nunca é armazenada junto aos dados.

### Details

**Derivação de chave**

```typescript
const key = createHash('sha256')
  .update('token-vault:' + process.env['CSRF_SECRET'])
  .digest()
```

O prefixo `token-vault:` vincula a chave derivada ao propósito — impede reutilização acidental da mesma chave base em contextos diferentes.

**Esquema de criptografia**

- Algoritmo: `aes-256-gcm` (autenticado — garante confidencialidade e integridade)
- IV: 12 bytes aleatórios por operação de escrita (NIST SP 800-38D)
- Auth tag: 16 bytes
- Encoding de saída: `base64url([iv(12) || authTag(16) || ciphertext])` — sem padding, seguro para IDs de documento

**Adapter ativo**

`FirestoreTokenVault` é o único adapter instanciado em produção. `SecretManagerTokenVault` existe como adapter alternativo implementando a mesma `TokenVaultPort` (ADR-002), mas não está instanciado — é reserva arquitetural.

**Ciclo de vida do token**

1. OAuth callback → `FirestoreTokenVault.store(tokenRef, plaintext)` → escreve doc criptografado em `token_vault/{tokenRef}`
2. Publicação → `FirestoreTokenVault.retrieve(tokenRef)` → descriptografa → token fresco para uso imediato
3. Revogação → delete do doc `token_vault/{tokenRef}` — sem necessidade de conhecer o conteúdo

**Rotação de chave**

Rotação de `CSRF_SECRET` invalida todos os tokens existentes — todos os usuários precisam reconectar OAuth. Deve ser planejada como evento de manutenção com comunicação prévia.

## References

- [_local-adr-policy-005-zero-trust-baseline](005-zero-trust-baseline.md) - Zero Trust como modelo base de segurança
- [_local-adr-policy-007-identidade-pairwise-e-consentimento](007-pairwise-identity-consent.md) - TokenRef e PairwiseId como entidades separadas
- [_local-adr-policy-017-separacao-pairwiseid-e-tokenref-oauth](../data/017-separacao-pairwiseid-tokenref-oauth.md) - Separação de identidade e referência de token
