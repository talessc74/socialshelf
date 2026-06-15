---
name: _local-bdr-policy-002-redes-sociais-suportadas
description: Define as redes sociais suportadas pelo SocialShelf e o status de integração de cada uma. Use ao priorizar integração de nova plataforma ou avaliar escopo de publicação.
apply-to: Todas as integrações com plataformas de redes sociais
valid-from: 2026-06-06
---

# _local-bdr-policy-002: Redes Sociais Suportadas

## Context and Problem Statement

Cada rede social tem APIs, regras de OAuth, formatos de conteúdo e limites de caracteres distintos. A decisão de quais plataformas suportar define escopo de integração, carga de manutenção e proposta de valor para o usuário.

Quais redes sociais o SocialShelf suporta e qual é o status de integração de cada uma?

## Decision Outcome

**Quatro plataformas: LinkedIn, X/Twitter, Instagram e Facebook (via Meta API)**

Integração exclusivamente via OAuth delegado — jamais credenciais diretas. Ver `_local-adr-policy-001-oauth-social-networks` para o modelo de integração.

### Details

**Status de integração**

| Plataforma | OAuth | Publicação | Status |
|---|---|---|---|
| LinkedIn | `profile`, `w_member_social` | Texto | Funcionando (Sprint 1) |
| X (Twitter) | Mínimos para posting | Texto | Código implementado, E2E pendente |
| Instagram | Meta Graph API | Imagem + texto | Aguardando deploy com HTTPS |
| Facebook | Meta Graph API | Texto + imagem | Aguardando deploy com HTTPS |

**Limites de conteúdo por plataforma**

Definidos em `packages/domain/src/entities/Platform.ts` como `PLATFORM_CHARACTER_LIMITS`:
- Os limites são parte do domínio — não hardcoded em adapters de publicação.
- Validação de limite acontece no `CreatePostUseCase` antes de persistir o post.

**Regras de integração**

- Cada plataforma tem use-cases de URL e callback independentes (`GenerateXAuthUrlUseCase`, `HandleXCallbackUseCase`, etc.).
- Cada plataforma tem um publisher independente (`XPublisher`, `LinkedInPublisher`, `MetaPublisher`) em `apps/publisher`.
- Tokens por marca: cada combinação `(brandId, platform)` tem credenciais OAuth isoladas.
- `pairwiseId` único por `(userId, platform)` — sem rastreamento cruzado entre plataformas.

**Adicionar nova plataforma**

Para adicionar uma nova rede social:
1. Adicionar a plataforma ao enum `Platform` em `packages/domain`.
2. Criar use-cases de OAuth em `apps/api/src/use-cases/oauth/`.
3. Criar adapter de publisher em `apps/publisher/src/infrastructure/publishers/`.
4. Atualizar `PLATFORM_CHARACTER_LIMITS`.
5. Nenhuma mudança necessária em use-cases existentes ou outros publishers.

## References

- [_local-adr-policy-001-oauth-social-networks](../../adrs/integration/001-oauth-social-networks.md) - Modelo de integração OAuth
- [_local-adr-policy-003-pairwise-identity-consent](../../adrs/controls/003-pairwise-identity-consent.md) - Identidade pairwise por plataforma
