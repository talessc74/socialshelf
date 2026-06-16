---
name: _local-edr-policy-012-zod-safeparse-validacao-de-input
description: Define o padrão de validação de input nas rotas Fastify. Use ao implementar nova rota ou ao tratar input externo de qualquer origem.
apply-to: apps/api — todas as routes
valid-from: 2026-06-16
---

# _local-edr-policy-012: Zod safeParse — Validação de Input

## Context and Problem Statement

Input não validado em boundary de sistema é a fonte mais comum de erros em runtime e comportamentos inesperados. TypeScript garante tipos em tempo de compilação — mas não em dados que chegam pela rede em tempo de execução.

Como garantir que todo input externo seja validado antes de ser usado em lógica de negócio?

## Decision Outcome

**`zod.safeParse()` em todos os inputs externos; 400 com `flatten()` em caso de falha**

### Details

**Padrão obrigatório em rotas**

```typescript
const schema = z.object({
  content: z.string().min(1),
  platform: z.nativeEnum(Platform),
})

const parsed = schema.safeParse(request.body)

if (!parsed.success) {
  return reply.status(400).send({
    error: 'invalid_input',
    details: parsed.error.flatten(),
  })
}

// parsed.data é tipado e seguro para usar
const { content, platform } = parsed.data
```

**Por que `safeParse` e não `parse`**

`parse()` lança exceção em input inválido — exige try/catch e produz stack trace. `safeParse()` retorna `{ success, data }` ou `{ success, error }` — tratável como fluxo normal sem exceção.

**`flatten()` para o cliente**

`zodError.flatten()` retorna:
```typescript
{
  formErrors: string[],       // erros não associados a campo
  fieldErrors: {              // erros por campo
    [field]: string[]
  }
}
```

Estrutura suficiente para o frontend exibir erros inline por campo sem lógica adicional.

**Enum de Platform validado em compilação**

`z.nativeEnum(Platform)` rejeita qualquer string que não seja um valor válido do enum — sem necessidade de validação manual de lista de strings.

**Onde validar**

Validação acontece na camada de rota (antes de chamar use-cases). Use-cases recebem dados já tipados e validados — nunca input cru.

## References

- [_local-edr-policy-010-formato-de-resposta-da-api](010-api-response-format.md) - `details` no formato de erro padronizado
- [_local-edr-policy-002-typescript-strict-mode](../principles/002-typescript-strict.md) - TypeScript strict como complemento em tempo de compilação
