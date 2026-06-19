---
name: _local-adr-policy-028-geracao-de-conteudo-multiartefato
description: Define como GenerationRequest representa post único e carrossel como o mesmo agregado (N≥1 artefatos), como o CTA é derivado de pauta+formato, e onde a geração de conteúdo via IA é implementada de fato. Use ao implementar GenerateContentUseCase, adapters Vertex AI/Imagen, ou qualquer rota de geração.
apply-to: packages/domain — GenerationRequest, GenerationArtifact, CopyGeneratorPort, ImageGeneratorPort; apps/generator — geração de conteúdo
valid-from: 2026-06-19
---

# _local-adr-policy-028: Geração de Conteúdo Multiartefato

## Context and Problem Statement

[_local-adr-policy-019-geracao-de-conteudo-maquina-de-estados](019-generation-state-machine.md) define os cinco estados de uma `GenerationRequest`, mas modela `outputs.generatedImagePath` como uma única imagem — não há lugar para representar um carrossel (N imagens). A Fase 3 do roadmap (`_local-bdr-plan-002`) exige suportar post único e carrossel como o mesmo agregado, sem bifurcação de lógica, mais CTA automático e estado granular por artefato.

Adicionalmente, a investigação de código mostrou que a geração de conteúdo via IA nunca foi implementada — existem apenas os tipos de domínio (`GenerationRequest`, `CopyGeneratorPort`, `ImageGeneratorPort`, `ImageStoragePort`) e o ADR-019. Não há use-case, adapter Vertex AI, nem rota em nenhum serviço. Esta decisão cobre tanto a extensão para multiartefato quanto a localização da implementação base, que nascem juntas.

## Decision Outcome

**`GenerationRequest.outputs.artifacts: GenerationArtifact[]` substitui `generatedImagePath: string | null` — post único é `artifacts.length === 1`, carrossel é `artifacts.length > 1`, o mesmo `GenerateContentUseCase` itera sobre a lista em ambos os casos.**

```typescript
type ArtifactStatus = 'pending' | 'generating' | 'ready' | 'failed'

interface GenerationArtifact {
  position: number
  status: ArtifactStatus
  imageStoragePath: string | null
  error: string | null
}
```

`GenerationRequest.inputs.artifactCount: number` declara quantos artefatos serão gerados antes do início — `GenerateContentUseCase` cria `artifactCount` entradas em `pending` e as preenche uma a uma, persistindo o array inteiro a cada conclusão individual (via `GenerationRequestRepository.updateOutputs()`), o que dá o "estado granular por artefato" exigido pelo roadmap sem precisar de sub-coleção própria por artefato.

### Details

**A geração via IA vive em `apps/generator`, como o pipeline de Pauta da Fase 2**

`apps/generator` já é o único serviço que chama IA generativa sem token OAuth de usuário (Vertex AI para Pauta — Fase 2). Geração de copy (Gemini) e imagem (Imagen) tem o mesmo perfil de risco — reaplica-se a decisão de ADR-027 em vez de abrir uma nova deliberação: nenhuma chamada de serviço para serviço nova é introduzida, `generator` ganha sua própria cópia de `FirestorePostRepository` (mesmo padrão de cada serviço reimplementar repositórios Firestore compartilhados já visto em `api`/`publisher`/`generator`).

**`GenerationRequest` em `ready` cria o `Post` automaticamente, como já decidido em ADR-019**

Quando todos os artefatos saem de `pending`/`generating` (terminam em `ready` ou `failed`) e a copy foi gerada, a requisição vai a `ready` e `GenerateContentUseCase` cria um `Post` com `status: 'ai-draft'`, `imageStoragePaths` populado apenas com os artefatos que chegaram a `ready` — falha parcial de artefato individual não impede a criação do post, só reduz a lista de imagens. Falha de **todos** os artefatos, ou falha da copy, leva a requisição a `failed` e nenhum post é criado.

**CTA é gerado junto com a copy, não como entidade própria**

`CopyGeneratorPort.generateCopy()` passa a retornar `{ copies: PlatformCopies; cta: string }` em vez de apenas `PlatformCopies`. CTA é texto, deriva do mesmo prompt de copy — não há razão para uma chamada de IA separada. O prompt recebe `format` (`'single' | 'carousel'`) e, quando a geração nasceu de uma sugestão de pauta, `pautaContext: { headline, rationale }` (a notícia verificada da Fase 2) — isso é o que o roadmap chama de "CTA sugerido a partir da pauta e do formato": carrossel tende a sugerir "arraste para ver mais", post único tende a sugerir engajamento direto (comentário, compartilhamento).

**Tokens de marca (Fase 0) entram como contexto textual do prompt, não como pós-processamento de imagem**

`ImageGeneratorPort.generateImage()` ganha `brandTokens?: { primaryColor, secondaryColor, typography } | null` no `ImagePrompt` — o adapter Imagen inclui essas informações como instrução textual do prompt ("usar paleta de cores X e Y, estilo tipográfico Z"). Não há composição programática de cores/fontes sobre a imagem gerada nesta fase; é a IA que recebe a instrução. Pós-processamento determinístico (overlay de logo, grid de cores exato) é decisão de fase futura, fora do escopo de Fase 3.

**`GenerationRequestRepository` ganha `updateOutputs()` para persistir progresso parcial**

```typescript
interface GenerationRequestRepository {
  save(request: GenerationRequest): Promise<void>
  findById(id: string): Promise<GenerationRequest | null>
  updateStatus(id: string, status: GenerationStatus, error?: string): Promise<void>
  updateOutputs(id: string, outputs: NonNullable<GenerationRequest['outputs']>): Promise<void>
  delete(id: string): Promise<void>
}
```

Cliente faz polling em `GET /generation-requests/:id` (mesmo padrão de ADR-019) e lê `outputs.artifacts[].status` para feedback de progresso por artefato, sem esperar o array completo.

## References

- [_local-adr-policy-019-geracao-de-conteudo-maquina-de-estados](019-generation-state-machine.md) - Máquina de estados estendida por esta decisão
- [_local-adr-policy-027-pauta-localizacao-e-verificacao-factual](027-pauta-localizacao-e-verificacao-factual.md) - Precedente reaplicado: IA generativa sem OAuth de usuário vive em generator
- [_local-adr-policy-025-brandprofile-schema-e-versionamento](025-brand-profile-schema-versionamento.md) - Origem dos tokens de marca usados no prompt de imagem
- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../../bdrs/product/plans/002-roadmap-equipe-marketing-autonoma.md) - Fase 3, que origina esta decisão
