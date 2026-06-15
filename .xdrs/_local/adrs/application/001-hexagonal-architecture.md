---
name: _local-adr-policy-001-hexagonal-architecture
description: Define a arquitetura hexagonal como padrão estrutural do SocialShelf. Use ao criar novos serviços, casos de uso, ou adaptar integrações externas.
apply-to: Todos os apps e packages do monorepo
valid-from: 2026-06-06
---

# _local-adr-policy-001: Arquitetura Hexagonal

## Context and Problem Statement

Com integrações a quatro redes sociais, Firebase, Vertex AI e Cloud Run, o SocialShelf precisa de uma estrutura que isole a lógica de negócio dos detalhes de infraestrutura para garantir testabilidade, substituibilidade e evolução segura.

Como estruturar o código para que mudanças de infraestrutura não contaminem a lógica de negócio?

## Decision Outcome

**Arquitetura hexagonal com domain layer puro, ports como interfaces e adapters de infraestrutura**

O `packages/domain` é a camada central: zero dependências externas, apenas TypeScript. Todos os serviços dependem do domain; o domain não depende de nenhum serviço.

### Details

**Estrutura obrigatória**

```
packages/domain/          ← núcleo: entidades + ports (sem dependências externas)
apps/[service]/
  src/
    use-cases/            ← orquestração: implementam a lógica de negócio
    infrastructure/       ← adapters: implementam os ports do domain
    routes/               ← entrypoints: expõem use-cases via HTTP
```

**Regras**

- Entidades (`User`, `Brand`, `Post`, `OAuthConnection`, `GenerationRequest`) residem exclusivamente em `packages/domain/src/entities/`.
- Ports são interfaces TypeScript puras em `packages/domain/src/ports/`. Exemplos: `OAuthRepository`, `TokenVaultPort`, `PublisherPort`, `CopyGeneratorPort`.
- Use-cases importam apenas do domain. Nunca importam diretamente de SDKs de infraestrutura (Firebase Admin, `@google-cloud/*`, etc.).
- Adapters (`FirestoreOAuthRepository`, `SecretManagerTokenVault`, `XPublisher`) ficam em `infrastructure/` e implementam os ports.
- Adicionar um novo serviço de publicação não requer alteração nos use-cases — apenas um novo adapter.

**Value Objects**
Lógica de domínio encapsulada como value objects no domain. Exemplo: `PairwiseId` (SHA256 de `userId:platform`, truncado em 32 chars) — garante identidades isoladas por plataforma por design.

## References

- [_local-adr-policy-001-engineering-principles](../principles/001-engineering-principles.md) - Inversão de dependência como princípio raiz
- [_local-adr-policy-003-service-decomposition](002-monorepo-pnpm-turbo.md) - Como os serviços se organizam no monorepo
- [_local-adr-policy-003-pairwise-identity-consent](../controls/003-pairwise-identity-consent.md) - PairwiseId como control de identidade
