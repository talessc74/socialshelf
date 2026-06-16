---
name: _local-bdr-policy-004-limites-de-caracteres-por-plataforma
description: Define os limites de caracteres por plataforma de publicação. Use ao implementar validação de conteúdo, exibir contadores no composer ou definir limites de geração de IA.
apply-to: packages/domain — Platform.ts; apps/api — CreatePostUseCase; apps/web — composer
valid-from: 2026-06-16
---

# _local-bdr-policy-004: Limites de Caracteres por Plataforma

## Context and Problem Statement

Cada rede social impõe um limite máximo de caracteres para posts. Publicar conteúdo que excede o limite causa erro na API da plataforma. O SocialShelf precisa conhecer e aplicar esses limites antes de tentar publicar.

Quais são os limites de caracteres por plataforma e onde eles são aplicados no sistema?

## Decision Outcome

**Limites declarados no domain como constante compilada; validação obrigatória antes da persistência**

### Details

**Limites vigentes**

| Plataforma | Limite (caracteres) | Observação |
|---|---|---|
| X (Twitter) | 280 | Inclui URLs encurtadas (t.co = 23 chars) |
| LinkedIn | 3.000 | Posts de artigo têm limite diferente — não suportados |
| Instagram | 2.200 | Caption do post; hashtags contam no limite |
| Facebook | 63.206 | Limite prático — posts longos têm engajamento reduzido |

**Localização no código**

```typescript
// packages/domain/src/entities/Platform.ts
export const PLATFORM_CHARACTER_LIMITS: Record<Platform, number> = {
  [Platform.TWITTER]: 280,
  [Platform.LINKEDIN]: 3000,
  [Platform.INSTAGRAM]: 2200,
  [Platform.FACEBOOK]: 63206,
}
```

**Ponto de validação**

`CreatePostUseCase` valida o conteúdo contra `PLATFORM_CHARACTER_LIMITS[platform]` antes de persistir. Post que excede o limite retorna HTTP 422 — nunca chega ao banco nem tenta publicar.

**Atualização de limites**

Plataformas podem alterar seus limites sem aviso prévio. Quando isso ocorrer:
1. Atualizar `PLATFORM_CHARACTER_LIMITS` em `packages/domain`
2. Atualizar esta tabela com a nova data de vigência
3. Verificar se o composer no frontend exibe o contador correto

**Contagem de caracteres**

A contagem usa `content.length` em TypeScript (número de code units UTF-16). Emojis compostos (como bandeiras) podem contar como mais de 1 caractere. Aplicar a mesma lógica de contagem que a plataforma alvo — verificar documentação de cada API em caso de dúvida.

## References

- [_local-bdr-policy-003-redes-sociais-suportadas](003-redes-sociais-suportadas.md) - Status de integração por plataforma
- [_local-adr-policy-018-post-maquina-de-estados-de-publicacao](../../adrs/application/018-post-state-machine.md) - Validação de limite como pré-condição para estado draft
