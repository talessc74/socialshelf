---
name: _local-adr-policy-025-brandprofile-schema-e-versionamento
description: Define o schema do BrandProfile (6 seções) e o modelo de versionamento imutável. Use ao implementar criação, edição ou consumo do contexto de marca por qualquer feature de criação ou automação.
apply-to: packages/domain — BrandProfile entity; apps/api — CreateBrandProfileVersionUseCase, brand-profile.routes
valid-from: 2026-06-19
---

# _local-adr-policy-025: BrandProfile — Schema e Versionamento

## Context and Problem Statement

O roadmap F0–F5 ([_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../../bdrs/product/plans/002-roadmap-equipe-marketing-autonoma.md)) estabelece que toda criação, sugestão e automação do SocialShelf deve estar "fincada na marca/assunto do usuário" — a marca é o contexto que atravessa todas as fases seguintes (Escuta, Pauta, Criação, Operação).

Sem um modelo explícito para esse contexto, cada feature futura (geração de pauta, criação multiformato, autonomia) acabaria definindo sua própria noção implícita de marca, fragmentando a fonte de verdade e impedindo rastreabilidade de qual definição de marca gerou qual post.

Como modelar o contexto de marca de forma que (a) cubra as dimensões necessárias para orientar criação e automação, (b) permita edição ao longo do tempo sem invalidar posts já criados sob uma definição anterior, e (c) sirva de base ao "dial de autonomia" que controla o quanto o sistema age sem revisão humana?

## Decision Outcome

**BrandProfile como agregado versionado e imutável, com 6 seções fixas e um dial de autonomia em `operation`**

```typescript
interface BrandProfile {
  id: string
  userId: string
  brandId: string
  version: number
  business: BrandProfileBusiness
  identity: BrandProfileIdentity
  visual: BrandProfileVisual
  voice: BrandProfileVoice
  narrative: BrandProfileNarrative
  operation: BrandProfileOperation
  createdAt: Date
}
```

### Details

**As 6 seções**

| Seção | Cobre |
|---|---|
| `business` | Negócio: o que a marca vende/oferece, segmento, público-alvo |
| `identity` | Identidade: nome, tom de marca, posicionamento |
| `visual` | Visual: paleta, tipografia, diretrizes de imagem |
| `voice` | Voz: registro de linguagem, vocabulário permitido/evitado |
| `narrative` | Narrativa: temas e pautas recorrentes da marca |
| `operation` | Operação: inclui `autonomyLevel: 'manual' \| 'semi-automatic' \| 'automatic'` — o dial de autonomia |

Cada seção é obrigatória na criação de uma versão — não há edição parcial de uma versão existente.

**Imutabilidade e versionamento**

- Toda edição cria uma nova versão (`version = latest.version + 1`); nenhuma versão existente é sobrescrita.
- `CreateBrandProfileVersionUseCase` é o único ponto de escrita: lê a versão mais recente via `BrandProfileRepository.findLatestByBrand`, incrementa e persiste um novo documento imutável.
- Persistência em `users/{brandId}/brands/{brandId}/brand_profiles/v{version}` — documento id explícito por versão, seguindo a hierarquia já estabelecida em [_local-adr-policy-020-firestore-hierarquia-de-sub-documentos](../platform/020-firestore-schema.md).

**Por que imutável em vez de mutável com histórico separado**

Um histórico separado (ex: coleção de "edições") exigiria reconstruir o estado da marca em um ponto no tempo a partir de um log de diffs. Versionamento imutável por documento completo permite leitura direta de qualquer versão por número, sem reconstrução — pré-requisito para o snapshot-por-referência descrito em [_local-edr-policy-022-snapshot-imutavel-de-brandprofile-por-post](../../edrs/application/022-snapshot-imutavel-brand-profile-post.md).

**`autonomyLevel` como parte do schema, não como configuração externa**

O dial de autonomia vive dentro de `operation` porque autonomia é uma propriedade da marca, não do sistema: marcas diferentes do mesmo usuário podem ter níveis de autonomia distintos, e o nível pode mudar de versão para versão conforme a confiança na automação evolui.

## References

- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../../bdrs/product/plans/002-roadmap-equipe-marketing-autonoma.md) - Roadmap que origina a Fase 0 (Núcleo da Marca)
- [_local-adr-policy-002-arquitetura-hexagonal](002-hexagonal-architecture.md) - BrandProfileRepository como port; FirestoreBrandProfileRepository como adapter
- [_local-adr-policy-020-firestore-hierarquia-de-sub-documentos](../platform/020-firestore-schema.md) - Hierarquia de coleções seguida por brand_profiles
- [_local-edr-policy-022-snapshot-imutavel-de-brandprofile-por-post](../../edrs/application/022-snapshot-imutavel-brand-profile-post.md) - Como Post referencia uma versão de BrandProfile
