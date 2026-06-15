---
name: _local-adr-policy-003-pairwise-identity-consent
description: Define o modelo de identidade pairwise e consentimento explícito do SocialShelf. Use ao projetar fluxos OAuth, armazenar conexões de rede social ou solicitar dados do usuário.
apply-to: Todos os fluxos OAuth, armazenamento de identidade e coleta de dados de usuário
valid-from: 2026-06-06
---

# _local-adr-policy-003: Identidade Pairwise e Consentimento

## Context and Problem Statement

Um SaaS que conecta múltiplas redes sociais pode, inadvertidamente, criar identificadores globais que permitem rastreamento cruzado entre plataformas — mesmo sem intenção. Além disso, qualquer acesso a dados do usuário sem consentimento explícito viola o princípio de minimal disclosure.

Como garantir que o sistema não crie superfícies de rastreamento cruzado e que todo acesso a dados seja precedido de consentimento explícito?

## Decision Outcome

**Identificadores pairwise determinísticos por plataforma + consentimento explícito como pré-requisito estrito**

Cada conexão OAuth recebe um identificador único por par `(usuário, plataforma)` — impedindo correlação entre plataformas. Consentimento explícito precede qualquer fluxo de dados.

### Details

**Pairwise Identity**

Implementado em `packages/domain/src/value-objects/PairwiseId.ts`:
```typescript
// SHA256(userId:platform), truncado em 32 caracteres
PairwiseId.generate(userId, platform)
```

- Cada `OAuthConnection` armazena `pairwiseId` — não o `userId` diretamente em contextos externos.
- O mesmo usuário conectando Instagram e LinkedIn tem `pairwiseId` distintos para cada plataforma.
- Rastreamento cruzado entre plataformas é impossível usando apenas `pairwiseId`.
- O `pairwiseId` é determinístico: pode ser recalculado a partir de `userId + platform` sem armazenar mapeamentos adicionais.

**Consentimento**

- Consentimento explícito é pré-requisito estrito antes de iniciar qualquer fluxo OAuth.
- O sistema solicita apenas escopos mínimos necessários para publicação — não escopos de leitura de dados que não serão usados.
- Escopos por plataforma:
  - LinkedIn: `profile`, `w_member_social`
  - X: escopos mínimos para posting
  - Meta: escopos mínimos para publicação em Instagram e Facebook
- Revogação pelo usuário tem efeito imediato: token é removido do Secret Manager e a `OAuthConnection` é deletada do Firestore.

**Minimal Disclosure**

Apenas os atributos estritamente necessários para a operação são solicitados e processados. Metadados de identidade gerados pelo sistema são criptografados ou descartados, salvo necessidade de segurança explicitamente documentada.

## References

- [_local-adr-policy-002-data-minimization](002-data-minimization.md) - Coleta mínima de dados
- [_local-adr-policy-001-oauth-social-networks](../integration/001-oauth-social-networks.md) - Fluxo OAuth completo
