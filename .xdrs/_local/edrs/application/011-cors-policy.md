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

**`origin` restrito a uma lista de origens permitidas (`CORS_ORIGINS`, com fallback para `WEB_URL`) com `credentials: true`**

```typescript
await app.register(cors, {
  origin: (process.env['CORS_ORIGINS'] ?? process.env['WEB_URL'] ?? 'http://localhost:3000')
    .split(',')
    .map((url) => url.trim()),
  credentials: true,
})
```

### Details

**`CORS_ORIGINS` como lista de origens permitidas (atualização 2026-07-12 — migração de domínio)**

Durante a migração de `radiokactus.com` para `socialshelf.com.br` (ver `_local-adr-policy-039`), o `api-service` precisa aceitar requisições vindas de **ambos** os domínios simultaneamente — o produto continua em produção com usuários reais em `radiokactus.com` enquanto `socialshelf.com.br` é testado. `WEB_URL` continua existindo como variável separada (single-value) porque também é usada para montar URLs de redirecionamento pós-OAuth (`apps/api/src/routes/oauth/*.routes.ts`) — essas não suportam lista, e por isso não foram alteradas nesta atualização. `CORS_ORIGINS` é uma variável nova, dedicada exclusivamente ao CORS, com fallback para `WEB_URL` caso não esteja definida (mantém compatibilidade em desenvolvimento local).

Em produção: `CORS_ORIGINS=https://socialshelf.com.br,https://radiokactus.com`. Em desenvolvimento local, nenhuma variável nova é necessária — o fallback para `WEB_URL=http://localhost:3000` (ou o padrão do código) continua válido.

**Redirect pós-OAuth de volta pro domínio de origem**: resolvido — ver `_local-adr-policy-014` (seção "webOrigin embarcado"). O mesmo array retornado por `getAllowedWebOrigins()` é reaproveitado para validar o header `Origin` recebido em `/oauth/{platform}/authorize` antes de embarcá-lo no state assinado.

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
