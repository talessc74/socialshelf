---
name: _local-adr-policy-045-chat-do-selfie-com-gemini
description: Define a arquitetura técnica do chat livre do Selfie — a porta SelfieAssistantPort, o fluxo apps/web → apps/api → apps/generator, por que o custo é registrado como observabilidade (AiUsageRecorderPort) e nunca desconta créditos do usuário, e como o contexto de conexões é montado no servidor. Use ao mexer em GeminiSelfieAssistant, AnswerSelfieQuestionUseCase, ou nas rotas /selfie/ask.
apply-to: packages/domain (SelfieAssistantPort), apps/generator (GeminiSelfieAssistant, AnswerSelfieQuestionUseCase, selfie.routes.ts), apps/api (selfie.routes.ts)
valid-from: 2026-11-23
---

# _local-adr-policy-045: Chat do Selfie com Gemini

## Context and Problem Statement

`_local-bdr-policy-011` (emenda 2026-11-23) decidiu que o Selfie passaria a responder
perguntas livres dos usuários sobre o produto, usando IA, com conhecimento do estado real de
conexão das redes sociais da marca. Essa decisão de produto não cobre como implementar — em
qual serviço o Gemini é chamado, como o custo se relaciona com o sistema de créditos já
existente (`_local-bdr-plan-002`, Fase 1-6 de créditos), e como o backend monta o contexto de
conexões sem confiar no que o cliente mandaria.

## Decision Outcome

**Replica o fluxo já usado por "Diagnóstico de Performance" (`AnalyzePerformancePatternsUseCase`
→ `GeminiPatternAnalyzer`), sem inventar um novo padrão de integração: `apps/web` → `apps/api`
(autenticado) → `apps/generator` (segredo interno) → cliente Gemini via `createGeminiClient`.
O custo é registrado via `AiUsageRecorderPort` (categoria `text-generation`, operação
`selfie-chat`) — a mesma observabilidade que todo texto gerado já usa — e nunca desconta o
saldo de créditos do usuário.**

### Details

**Por que não desconta créditos**

`applyCreditConsumption` (o que de fato subtrai de `CreditBalance`) é chamado em exatamente um
lugar do código inteiro: `GenerateContentUseCase`, e só quando há imagens geradas
(`input.imageStoragePaths.length === 0 && monthlyCreditsIncluded !== null` — ver o comentário
`CREDIT_COST_BRL`: "texto/TTS são centavos de centavo... por isso ficam de fora do sistema de
créditos"). O chat do Selfie é uma chamada de texto puro, igual ao diagnóstico de performance
— então, por desenho já estabelecido antes desta ADR, não tem relação nenhuma com créditos.
Tratá-lo como ajuda/suporte, não como geração de conteúdo, é consistente com essa fronteira já
existente, não uma exceção nova.

**Porta nova: `SelfieAssistantPort`** (`packages/domain/src/ports/SelfieAssistantPort.ts`)

```ts
export interface SelfieChatTurn { role: 'user' | 'selfie'; text: string }
export interface SelfieAccountStatus {
  platform: Platform
  connected: boolean
  accountLabel: string | null
  connectionLikelyExpired: boolean
}
export interface SelfieAssistantPort {
  answer(question: string, history: SelfieChatTurn[], accountStatus: SelfieAccountStatus[], userId: string, brandId: string): Promise<string>
}
```

`connectionLikelyExpired` é um sinal, não uma garantia — só `expiresAt` no passado, calculado
no `apps/api` a partir do `OAuthConnection` real (`FirestoreOAuthRepository.findByBrand`).
Confirmar de verdade exigiria uma chamada real à API da rede (como o job de refresh de
`_local-adr-policy-016` já faz); o chat só usa o sinal barato para sugerir reconexão, nunca
afirma com certeza que a conexão está quebrada.

**`GeminiSelfieAssistant`** (`apps/generator/src/infrastructure/vertexai/`) implementa a porta:
prompt de texto simples (sem `responseMimeType: 'application/json'`, diferente do
`GeminiPatternAnalyzer` — a resposta é conversa, não dado estruturado), montado com
persona/regras de escopo + `SELFIE_KNOWLEDGE_BASE` (texto fixo escrito à mão, reaproveitando o
conteúdo já escrito no Manual/Guia Visual do SocialShelf) + resumo de conexões + até 10 últimos
turnos de histórico + a pergunta. `recordGeminiUsage` chamado após `generateContent`, mesmo
padrão de todo o resto do diretório.

**Rotas**: `POST /selfie/ask` em `apps/generator` (atrás de `x-internal-secret`, mesmo padrão
de `performance-insights.routes.ts`) e em `apps/api` (atrás de `app.authenticate`, **sem**
`app.requirePlanFeature(...)` — decisão deliberada: ajuda não é uma feature paga, disponível a
qualquer tier incluindo legado/grátis). O `apps/api` busca
`oauthRepo.findByBrand(request.userId, request.brandId)` e monta o `accountStatus` para todas
as `ALL_PLATFORMS`, nunca aceitando esse resumo vindo do cliente.

**Sem gate de rate limit dedicado** — o `@fastify/rate-limit` já registrado globalmente em
`apps/api/src/app.ts` (100 req/min) cobre a rota nova automaticamente.

### Fora de escopo desta ADR (ver `_local-bdr-policy-011`, emenda 2026-11-23, para o racional de produto)

- Histórico persistido no servidor — stateless, resent pelo cliente a cada pergunta, limitado
  a 10 turnos.
- RAG/busca semântica sobre documentação — a base de conhecimento é um texto fixo.
- Contexto da tela atual do usuário — o chat é global, só enxerga conexões, não o que está
  sendo exibido na tela naquele momento.

## Conflicts

Nenhum identificado. Reaproveita a arquitetura já estabelecida por `_local-adr-policy-002`
(hexagonal) e o fluxo de serviço-a-serviço já usado por "Diagnóstico de Performance"; não
introduz um padrão novo de integração.

## References

- [_local-bdr-policy-011-selfie-assistente-contextual](../../bdrs/product/011-selfie-assistente-contextual.md) - Decisão de produto (emenda 2026-11-23) que esta ADR implementa
- [_local-edr-policy-049-selfie-implementacao](../../edrs/application/049-selfie-implementacao.md) - Implementação de frontend (painel de chat, mascote sempre visível)
- [_local-adr-policy-002-arquitetura-hexagonal](../application/002-hexagonal-architecture.md) - Padrão de portas/adapters seguido pela `SelfieAssistantPort`
- [_local-adr-policy-016-refresh-de-token-oauth-por-plataforma](016-refresh-token-oauth.md) - Mecanismo real de detecção/correção de conexão expirada; o chat só sinaliza, não substitui
