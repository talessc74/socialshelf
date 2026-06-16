---
name: _local-edr-policy-011-cors-restrito-a-web-url
description: Define a política CORS dos serviços Fastify. Use ao alterar origens permitidas ou ao adicionar suporte a novo cliente web.
apply-to: apps/api — app.ts
valid-from: 2026-06-16
---

# _local-edr-policy-011: CORS Restrito à WEB_URL

## Context and Problem Statement

CORS permissivo (`origin: '*'`) permite que qualquer página web faça requisições autenticadas ao api-service em nome de um usuário logado. Em um SaaS com tokens OAuth sensíveis, isso é um vetor de ataque real.

Como restringir o acesso CORS ao mínimo necessário para o funcionamento do produto?

## Decision Outcome

**`origin` restrito à variável `WEB_URL` com `credentials: true`**

```typescript
await app.register(cors, {
  origin: process.env['WEB_URL'],
  credentials: true,
})
```

### Details

**`WEB_URL` como única origem permitida**

`WEB_URL` é injetado como variável de ambiente no deploy (Cloud Run). Em produção, aponta para `https://radiokactus.com`. Em desenvolvimento local, deve ser configurado como `http://localhost:3000`.

**Por que `credentials: true`**

O frontend envia o Firebase ID Token no header `Authorization: Bearer`. Sem `credentials: true`, o browser bloqueia requisições com headers personalizados em contexto cross-origin.

**`credentials: true` com `origin: '*'` é inválido**

A combinação é rejeitada pelo browser. A origem deve ser explícita sempre que credenciais são necessárias — esta é uma restrição do protocolo CORS, não uma escolha do SocialShelf.

**Preflight requests**

Fastify CORS responde automaticamente a requisições `OPTIONS` com os headers corretos. Nenhuma rota precisa tratar `OPTIONS` manualmente.

**Novos clientes**

Se um segundo cliente (ex: app mobile com WebView, portal admin) precisar acessar o api-service, a política CORS deve ser revisada antes — ou um endpoint dedicado com política própria deve ser criado.

## References

- [_local-adr-policy-005-zero-trust-baseline](../../adrs/controls/005-zero-trust-baseline.md) - Restrição de origem como controle de acesso
- [_local-edr-policy-003-fastify-plugins-padrao](003-fastify-plugins.md) - cors como plugin obrigatório do Fastify
