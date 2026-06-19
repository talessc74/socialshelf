---
name: _local-edr-policy-022-snapshot-imutavel-de-brandprofile-por-post
description: Define como um Post referencia o BrandProfile vigente no momento da criação. Use ao criar posts, ao ler posts publicados, ou ao alterar o schema de BrandProfile.
apply-to: packages/domain — Post, BrandProfile; apps/api — CreatePostUseCase
valid-from: 2026-06-19
---

# _local-edr-policy-022: Snapshot Imutável de BrandProfile por Post

## Context and Problem Statement

Cada post é criado sob uma definição de marca específica (tom, voz, narrativa, autonomia). Se essa definição mudar depois — uma nova versão de `BrandProfile` for criada — o post já existente não deve mudar de significado retroativamente: o histórico de criação precisa refletir a marca como ela era no momento, não a versão atual.

Guardar uma cópia completa do `BrandProfile` dentro de cada `Post` duplicaria dados e exigiria sincronização caso algum dia se decida corrigir um erro de digitação retroativamente em todas as cópias. Não guardar nada torna impossível auditar sob qual contexto de marca um post foi criado.

Como referenciar o `BrandProfile` vigente em um post sem duplicar o agregado inteiro, mantendo a referência válida mesmo após novas versões serem criadas?

## Decision Outcome

**Post armazena apenas o número da versão (`brandProfileVersion: number | null`), nunca uma cópia do BrandProfile**

```typescript
interface Post {
  // ...
  brandProfileVersion: number | null
}
```

### Details

**Por que número de versão é suficiente**

[_local-adr-policy-025-brandprofile-schema-e-versionamento](../../adrs/application/025-brand-profile-schema-versionamento.md) estabelece que versões de `BrandProfile` são imutáveis — uma vez criada, a versão `N` nunca é alterada. Isso torna a referência `(brandId, version)` estável para sempre: ler `BrandProfileRepository.findByBrandAndVersion(brandId, N)` no futuro retorna exatamente o mesmo conteúdo que existia no momento da criação do post.

**Captura no momento da criação**

`CreatePostUseCase.execute()` busca a versão mais recente via `BrandProfileRepository.findLatestByBrand(brandId)` e grava seu número em `brandProfileVersion` no momento em que o post é criado — não em momentos posteriores (edição, publicação, leitura).

```typescript
const latestBrandProfile = await this.brandProfileRepo.findLatestByBrand(input.brandId)
const post: Post = {
  // ...
  brandProfileVersion: latestBrandProfile?.version ?? null,
}
```

**`null` é um valor válido**

Um brand antes de ter qualquer `BrandProfile` criado ainda pode criar posts — `brandProfileVersion: null` significa "criado sem contexto de marca definido", não um erro. Consumidores futuros (geração de pauta, automação) devem tratar `null` como ausência de contexto, não lançar exceção.

**O que isso não resolve**

Esse padrão não cobre o que fazer quando um post é editado depois que uma nova versão de `BrandProfile` existe — `brandProfileVersion` não é recalculado em edição, apenas fixado na criação. Re-snapshot em edição é decisão de fase futura, fora do escopo da Fase 0.

## References

- [_local-adr-policy-025-brandprofile-schema-e-versionamento](../../adrs/application/025-brand-profile-schema-versionamento.md) - Imutabilidade de versões que torna este padrão válido
- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../../bdrs/product/plans/002-roadmap-equipe-marketing-autonoma.md) - Fase 0, que origina esta decisão
- [_local-edr-policy-001-tdd-obrigatoria](../principles/001-tdd.md) - Testes que cobrem null, incremento e não-mutação do snapshot
