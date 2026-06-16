---
name: _local-edr-policy-010-formato-de-resposta-da-api
description: Define o formato padrão de resposta HTTP dos serviços Fastify. Use ao implementar novas rotas ou ao tratar erros em rotas existentes.
apply-to: apps/api e apps/publisher — todas as routes
valid-from: 2026-06-16
---

# _local-edr-policy-010: Formato de Resposta da API

## Context and Problem Statement

Sem um contrato de resposta uniforme, cada rota pode retornar erros e sucessos em formatos diferentes — forçando o cliente a lidar com múltiplas estruturas e tornando o tratamento de erro no frontend frágil.

Como garantir que todas as rotas dos serviços Fastify retornem respostas em formato previsível?

## Decision Outcome

**Dois formatos canônicos: envelope de recurso para sucesso, envelope de erro para falha**

### Details

**Sucesso**

```typescript
// HTTP 200/201
{ [resourceName]: value }

// Exemplos:
{ post: { id, content, status, ... } }
{ connections: [ ... ] }
{ url: "https://..." }
```

O nome da chave é o nome do recurso no singular (para objetos) ou plural (para coleções).

**Erro com detalhes de validação**

```typescript
// HTTP 400 — falha de validação de input
{ error: string, details: ZodFlattenedError }

// Exemplo:
{ error: "invalid_input", details: { fieldErrors: { content: ["Too long"] } } }
```

`details` é o resultado de `zodError.flatten()` — estrutura hierárquica de erros por campo.

**Erro simples**

```typescript
// HTTP 401 / 403 / 404 / 409 / 422 / 500
{ error: string }

// Com contexto adicional:
{ error: string, detail: string }

// Exemplos:
{ error: "unauthorized" }
{ error: "oauth_failed", detail: "invalid_state" }
{ error: "character_limit_exceeded" }
```

**Status HTTP e semântica**

| Código | Uso |
|---|---|
| 200 | Sucesso em leitura ou operação |
| 201 | Recurso criado |
| 400 | Input inválido (com `details`) |
| 401 | Não autenticado |
| 403 | Autenticado mas sem permissão |
| 404 | Recurso não encontrado |
| 409 | Conflito (ex: conexão duplicada) |
| 422 | Regra de negócio violada (ex: limite de caracteres) |
| 500 | Erro interno não antecipado |

**O que não é permitido**

- Retornar `{ success: true/false }` — usar status HTTP
- Retornar `{ message: string }` como envelope principal — usar `{ error: string }`
- Retornar stack trace em produção

## References

- [_local-edr-policy-012-zod-safeParse-validacao](012-zod-validation.md) - `details` gerado por Zod flatten()
- [_local-edr-policy-003-fastify-plugins-padrao](003-fastify-plugins.md) - Fastify como framework das rotas
