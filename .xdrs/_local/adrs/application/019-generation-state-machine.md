---
name: _local-adr-policy-019-geracao-de-conteudo-maquina-de-estados
description: Define os estados do ciclo de vida de uma GenerationRequest. Use ao implementar geração de conteúdo via IA, polling de status ou tratamento de falhas no generator-service.
apply-to: packages/domain — GenerationRequest entity; apps/generator
valid-from: 2026-06-16
---

# _local-adr-policy-019: Geração de Conteúdo — Máquina de Estados

## Context and Problem Statement

Geração de conteúdo via IA (copy + imagem) é uma operação assíncrona que pode levar segundos a minutos. O processo tem etapas distintas (geração de texto e geração de imagem) que podem falhar independentemente. Sem estados explícitos, o cliente não tem como distinguir "em andamento" de "falhou silenciosamente".

Como modelar o ciclo de vida de uma `GenerationRequest` de forma que o estado seja sempre observável e as falhas sejam diagnosticáveis?

## Decision Outcome

**Cinco estados com outputs nullable até conclusão e mensagem de erro em falha**

```typescript
type GenerationStatus =
  | 'pending'
  | 'generating-copy'
  | 'generating-image'
  | 'ready'
  | 'failed'
```

### Details

**Diagrama de transições**

```
pending → generating-copy → generating-image → ready
                    ↓                ↓
                  failed           failed
```

**Descrição dos estados**

| Estado | copyOutput | imageOutput | errorMessage |
|---|---|---|---|
| `pending` | null | null | null |
| `generating-copy` | null | null | null |
| `generating-image` | string | null | null |
| `ready` | string | string | null |
| `failed` | null ou string | null | string (obrigatório) |

**Regras de transição**

- `pending` → `generating-copy`: job de geração iniciado
- `generating-copy` → `generating-image`: copy gerada com sucesso; imageOutput ainda null
- `generating-image` → `ready`: imagem gerada; ambos outputs preenchidos
- `generating-copy` → `failed`: falha na geração de copy; errorMessage obrigatório
- `generating-image` → `failed`: falha na geração de imagem; copyOutput pode estar preenchido

**Resultado em `ready`**

Uma `GenerationRequest` em estado `ready` cria automaticamente um `Post` com status `ai-draft` (ADR-018). O conteúdo gerado é proposta — não publicável sem revisão humana.

**Polling**

O cliente faz polling em `GET /generation-requests/{id}` até `status === 'ready'` ou `status === 'failed'`. O intervalo recomendado é 2 segundos com timeout de 5 minutos.

## References

- [_local-adr-policy-018-post-maquina-de-estados-de-publicacao](018-post-state-machine.md) - Post em ai-draft como resultado de GenerationRequest ready
- [_local-adr-policy-010-gcp-infrastructure-baseline](../platform/010-gcp-infrastructure.md) - Vertex AI como backend de geração
