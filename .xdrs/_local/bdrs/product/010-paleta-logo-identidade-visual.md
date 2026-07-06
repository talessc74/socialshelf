---
name: _local-bdr-policy-010-paleta-do-logo-nova-identidade-visual
description: Substitui a paleta de accent por azuis e verdes extraídos diretamente do logo oficial do SocialShelf. Use ao criar ou revisar telas, tokens de tema ou qualquer referência de cor no código. Supercede a seção "Paleta" da _local-bdr-policy-005.
apply-to: apps/web/src/app/globals.css; apps/web/tailwind.config.ts; toda interface de usuário
valid-from: 2026-07-01
---

# _local-bdr-policy-010: Paleta do Logo — Nova Identidade Visual

## Context and Problem Statement

O logo oficial do SocialShelf foi finalizado em julho/2026 com paleta própria de azuis e verdes. O tema do site até então usava azul-céu genérico do Tailwind (`#0ea5e9`) como accent, sem nenhuma relação com o logo — gerando dissonância entre a identidade da marca e a interface do produto.

A Galera de Design convocada em 2026-07-01 avaliou o logo, extraiu as cores e decidiu pela substituição completa da paleta (Opção A — paleta completa nova), rejeitando a alternativa de troca apenas do accent (Opção B).

## Decision Outcome

**Paleta completa substituída pelos azuis e verdes do logo. Fundo neutro frio. Identidade visual alinhada ao logo em todos os tokens semânticos.**

Esta policy supercede a seção **Paleta** da `_local-bdr-policy-005-design-tokens-identidade-visual`. As demais seções da BDR-005 (tom de copy, componentes-padrão, hierarquia de conflito) permanecem válidas.

### Cores extraídas do logo

| Grupo | Hex | Uso |
|---|---|---|
| Azul escuro | `#1c426d` | ink, contrast, sidebar |
| Azul médio | `#347aae` | brand.500 (legado) |
| Azul-ciano médio | `#39a3cc` | accent (light mode) |
| Azul-ciano claro | `#44a9c1` | accent (dark mode) |
| Verde escuro | `#319970` | — |
| Verde médio | `#41a36e` | positive (light mode) |
| Verde claro | `#7bb752` | positive (dark mode) |
| Neutro claro | `#f5f9fa` | bg (light mode) |
| Neutro médio | `#ebedf1` | card-2, surface.operation |
| Neutro borda | `#d9dce0` | line |

### Tokens semânticos (modo claro)

| Token | Valor | Descrição |
|---|---|---|
| `--ss-bg` | `#f5f9fa` | Fundo da página |
| `--ss-card` | `#ffffff` | Fundo de card |
| `--ss-card-2` | `#ebedf1` | Fundo de card secundário |
| `--ss-ink` | `#1c426d` | Texto principal |
| `--ss-muted` | `#5a7a99` | Texto secundário |
| `--ss-muted-2` | `#3d6080` | Texto terciário |
| `--ss-line` | `#d9dce0` | Bordas e divisores |
| `--ss-accent` | `#39a3cc` | CTA, links, destaques |
| `--ss-accent-soft` | `#ddf0f8` | Fundo de badges de accent |
| `--ss-accent-ink` | `#ffffff` | Texto sobre accent |
| `--ss-contrast` | `#1c426d` | Sidebar, áreas de alto contraste |
| `--ss-contrast-ink` | `#ffffff` | Texto sobre contrast |
| `--ss-positive` | `#41a36e` | Indicadores positivos, deltas |

### Tokens semânticos (modo escuro)

| Token | Valor |
|---|---|
| `--ss-bg` | `#0b0e14` |
| `--ss-card` | `#111828` |
| `--ss-card-2` | `#172032` |
| `--ss-ink` | `#dde8f4` |
| `--ss-muted` | `#7a9cbf` |
| `--ss-muted-2` | `#9ab8d4` |
| `--ss-line` | `#1e2d42` |
| `--ss-accent` | `#44a9c1` |
| `--ss-accent-soft` | `#0e2233` |
| `--ss-contrast` | `#172032` |
| `--ss-contrast-ink` | `#dde8f4` |
| `--ss-positive` | `#7bb752` |

### Paleta legada `brand.*`

A escala `brand` no `tailwind.config.ts` foi atualizada para os azuis do logo (50 → 900), substituindo o azul-céu genérico. Componentes legados que ainda referenciam `brand.*` diretamente herdam automaticamente as novas cores.

### Alternativa rejeitada

**Opção B (troca apenas do accent):** manter fundo beige quente `#fbf5ee` e sidebar escuro `#2a2320`, trocar apenas os botões/links do coral para `#39a3cc`. Rejeitada porque preservava a dissonância entre fundo quente e logo frio — o resultado visual era híbrido, sem identidade coesa.

## Consequências

- Todas as telas que usam tokens semânticos (`bg-bg`, `text-ink`, `bg-accent`, etc.) atualizam automaticamente sem alteração de código além do `globals.css`
- Telas que referenciam `brand.*` diretamente atualizam via `tailwind.config.ts`
- Modo escuro mantém hierarquia de contraste WCAG AA com os novos valores
- A paleta coral (`#ff6b4a`) é considerada descontinuada — não deve ser usada em código novo

## References

- [_local-bdr-policy-005-tokens-de-identidade-visual](005-tokens-identidade-visual.md) - Policy anterior de tokens — seção Paleta supercedida por esta
- [_local-bdr-policy-001-principios-de-ux](../principles/001-ux-principles.md) - Hierarquia de conflito que governa qualquer decisão visual
