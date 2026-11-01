---
name: _local-adr-policy-044-sistema-de-creditos-de-ia
description: Implementação técnica do saldo de créditos de IA (CreditBalance, reposição mensal preguiçosa, clampagem de artifactPlan, compra avulsa via Stripe) que substitui a trava diária de gasto em R$. Use ao mexer em CreditBalance, Credits.ts, geração de conteúdo, tick de autonomia, ou webhook do Stripe.
apply-to: packages/domain — entities/CreditBalance.ts, value-objects/Credits.ts, ports/CreditBalanceRepository.ts; apps/api — infrastructure/firestore/FirestoreCreditBalanceRepository.ts, use-cases/billing/CreateCreditsCheckoutSessionUseCase.ts, use-cases/billing/HandleStripeWebhookUseCase.ts, routes/billing.routes.ts; apps/generator — lib/creditSpending.ts, use-cases/GenerateContentUseCase.ts, use-cases/EditArtifactUseCase.ts; apps/publisher — use-cases/AutonomyTickUseCase.ts; apps/web — contexts/SubscriptionContext.tsx, components/CreditConfirmModal.tsx
valid-from: 2026-11-01
---

# _local-adr-policy-044: Sistema de Créditos de IA

## Context and Problem Statement

`_local-bdr-policy-014` decide trocar o teto de gasto diário em R$ (`_local-edr-policy-073`)
por um saldo de créditos mensal — 1 crédito = 1 imagem gerada por IA. Como implementar isso
de forma que (a) o pior caso de qualquer plano nunca ultrapasse o que foi pago, (b) o usuário
veja e confirme explicitamente quanto uma ação vai custar antes de gerar, (c) a reposição
mensal não precise de um job agendado novo, e (d) publicação automática (sem ninguém
revisando) continue funcionando dentro do orçamento?

## Decision Outcome

**`CreditBalance` é um documento por usuário (não por marca) com reposição preguiçosa por
mês-calendário de Brasília. Toda geração de imagem por IA passa por `resolveEffectiveCreditState`
antes de chamar qualquer API paga — o saldo disponível clampa quantas imagens a geração pode
tentar produzir, e o débito real acontece depois, pelo número de imagens de fato produzidas,
nunca pelo teto negociado antes.**

### Details

**Modelo de dados — `CreditBalance`**

```ts
interface CreditBalance {
  userId: string
  periodKey: string                 // 'YYYY-MM', mês-calendário de Brasília
  planCreditsTotal: number
  planCreditsUsed: number
  purchasedCreditsBalance: number   // avulso, nunca expira
  createdAt: Date
  updatedAt: Date
}
```

Por usuário, não por marca — mesmo raciocínio de `Subscription`: o plano é contratado por
usuário, então uma conta Agência com 3 marcas compartilha um saldo único. Uma marca que
consome tudo deixa as outras sem saldo no resto do mês — simplificação deliberada, documentada
como escolha, não limite técnico.

**Reposição preguiçosa, sem cron novo**

`packages/domain/src/value-objects/Credits.ts` é a fonte única de verdade:

- `resolveEffectiveCreditState(balance, planMonthlyCredits, now)` — compara `balance.periodKey`
  salvo com `brasiliaMonthKey(now)` (nova função em `BrasiliaDate.ts`, mesmo raciocínio de fuso
  de `brasiliaDateNow`/`startOfBrasiliaDay`). Se o mês mudou, o saldo usado do plano é tratado
  como zero — sem gravar nada, é só leitura. `planMonthlyCredits: null` = ilimitado
  (legacy/admin), nunca bloqueia.
- `applyCreditConsumption(balance, userId, planMonthlyCredits, amount, now)` — mesma lógica de
  normalização de período, só que grava: desconta primeiro do saldo do plano no período atual
  (repondo se necessário), avança pro avulso (`purchasedCreditsBalance`) só depois que o plano
  esgota. Nunca fica negativo.
- `applyCreditPurchase(balance, userId, planMonthlyCredits, purchasedAmount, now)` — soma ao
  pool de avulso, nunca mexe no saldo do plano.

Upgrade de plano no meio do mês eleva o teto na hora (próxima leitura já usa
`planMonthlyCredits` novo); downgrade abaixa na hora também, sem nunca deixar
`planRemaining` negativo (clampado em 0).

**Onde o crédito é de fato gasto**

Confirmado lendo o código antes de implementar: `GenerateContentUseCase` só chama
`imageGenerator.generateImage()` quando não há `imageStoragePaths` de entrada (modo `'free'`
— geração de verdade); quando o usuário sobe as próprias fotos (modo `'fixed'`), o artefato
reaproveita o arquivo enviado, sem chamar a API de imagem — **não consome crédito nenhum**,
mesma lógica que já valia pra campanhas de fotos (`_local-adr-policy-041`).

- `apps/generator/src/lib/creditSpending.ts` — `resolveEffectiveMaxArtifacts(totalAvailable)`
  clampa `artifactPlan: { mode: 'free', maxCount: N }` pelo saldo disponível em vez do teto
  fixo `MAX_GENERATION_ARTIFACTS` (10) — a IA nunca é instruída a tentar mais imagens do que o
  usuário pode pagar. `hasCreditsAvailable(totalAvailable)` é a checagem de pré-voo: saldo ≤ 0
  (e não ilimitado) bloqueia antes de qualquer chamada de IA, com `NO_CREDITS_AVAILABLE_MESSAGE`
  (substitui `AI_SPENDING_LIMIT_REACHED_MESSAGE`, removida).
- Depois que a geração termina, `GenerateContentUseCase` desconta **o número real de artefatos
  prontos** (`readyArtifacts.length`), nunca o teto mostrado antes — artefato que falhou não é
  cobrado.
- `EditArtifactUseCase` sempre chama `generateImage` exatamente 1 vez por edição bem-sucedida —
  desconta exatamente 1 crédito, só quando o `try` de fato produz uma imagem nova.

**Publicação automática tem o mesmo gate, verificado antes de gastar com sugestão/classificação**

`AutonomyTickUseCase.processBrand` — logo depois da checagem de `isAutonomyLevelWithinPlan`
(já existente), uma nova checagem de `resolveEffectiveCreditState` decide `action:
'skipped-no-credits'` (nova entrada em `AutonomyTickAction`) antes de chamar
`generatorClient.suggestTopics`/`classifyAutonomy` — evita gastar essas chamadas à toa quando
o tick já sabe que não vai conseguir gerar. O `apps/generator` (cross-service, chamado via
`GeneratorAutonomyClient`) já recusaria de qualquer forma dentro de `GenerateContentUseCase` —
essa checagem antecipada é só pra dar um motivo específico no histórico do tick em vez de um
`'failed'` genérico vindo de dentro da geração.

**"Até X créditos" mostrado antes de confirmar — sempre o pior caso, nunca o estourando**

`apps/web/src/components/CreditConfirmModal.tsx` — antes de chamar `api.generateContent`/
`api.editArtifact`, a tela busca o saldo atual (`refreshCredits()` em
`SubscriptionContext.tsx`) e mostra `min(MAX_GENERATION_ARTIFACTS, totalAvailable)` como teto
de créditos que a ação pode consumir. Como o número final de imagens só é decidido pela IA
depois que a geração já começou, mostrar o pior caso garante que o aviso nunca é menor do que
o que de fato pode ser cobrado. Modo `'fixed'` (fotos próprias) pula o modal inteiramente —
não há crédito em jogo. Saldo ilimitado (`totalAvailable: null`) também pula o modal, segue
direto. Edição de artefato sempre mostra exatamente 1 (sempre gera 1 imagem).

**Compra avulsa — Checkout em modo pagamento único, não assinatura**

`CreateCreditsCheckoutSessionUseCase` usa `stripe.checkout.sessions.create({ mode: 'payment',
... })` com `price_data` inline (`currency: 'brl'`, `unit_amount: creditAmount * 30` —
R$0,30/crédito em centavos) em vez de Price IDs pré-cadastrados no Dashboard — só 3 pacotes
fixos (50/150/400), não vale o passo manual extra que a assinatura precisa (price IDs por
tier×ciclo). `HandleStripeWebhookUseCase` ganha um novo caso, `checkout.session.completed`,
que só age quando `session.mode === 'payment'` (sessões de assinatura já são tratadas
inteiramente pelos eventos `customer.subscription.*`, que o Stripe dispara de qualquer
forma) — credita via `applyCreditPurchase`, lendo `userId`/`creditAmount` do
`metadata` da sessão.

`ensureStripeCustomer` (antes um método privado de `CreateCheckoutSessionUseCase`) virou uma
função solta (`apps/api/src/use-cases/billing/ensureStripeCustomer.ts`), compartilhada entre
assinatura e compra avulsa — mesmo Customer do Stripe pras duas.

**Removido, não mantido em paralelo**

`dailyAiSpendingLimitBrl` (campo por marca, `BrandProfileOperation`), `AiSpendingGuardPort`
(port + implementação `sumCostUsdSince` em `FirestoreAiUsageRepository`),
`isAiSpendingLimitReached`/`resolveEffectiveDailyLimitBrl` (`apps/generator/lib/
aiSpendingLimit.ts`, arquivo deletado), e a validação `spending_limit_above_plan` em
`PUT /brand-profile`. O campo `dailyAiSpendingLimitBrl` continua existindo no *schema* salvo
(compatibilidade com documentos já gravados — nenhuma migração em lote), mas não tem mais UI
nem é lido por nenhum gate. `AiUsageEvent`/`/dashboard/ai-usage` (histórico em R$) foi mantido
como tela só informativa — não decide mais nada.

## Consequences

- `PlanLimits.defaultDailyAiSpendingLimitBrl` virou `monthlyCreditsIncluded: number | null` —
  qualquer gate que lia o campo antigo precisou de revisão (eram só 2: `GenerateContentUseCase`/
  `EditArtifactUseCase`, já que `AutonomyTickUseCase` só lia `maxAutoPostsPerDayCeiling`/
  `maxAutonomyLevel`, não o teto de gasto).
- `allowTikTokVideo` passou a ser `false` em todos os planos vendidos (free→agency) — só
  `legacy`/admin mantêm `true`, usado como acesso de teste enquanto o bloqueio de CNPJ não é
  resolvido (`_local-bdr-policy-014`).
- `GET /billing/credits` (novo) é o único ponto de leitura do saldo efetivo — `GET /ai-usage`
  também devolve `credits` (além do histórico em R$ informativo), pra não duplicar a mesma
  conta em dois formatos divergentes.

## References

- [_local-bdr-policy-014-sistema-de-creditos-e-tiktok-em-breve](../../bdrs/product/014-sistema-de-creditos-tiktok-em-breve.md) - Decisão de negócio que esta ADR implementa
- [_local-edr-policy-073-trava-diaria-de-gasto-com-ia](../../edrs/application/073-trava-diaria-de-gasto-com-ia.md) - Mecanismo antigo, removido por esta decisão
- [_local-adr-policy-043-assinatura-via-stripe-integracao-tecnica](043-assinatura-stripe-integracao-tecnica.md) - `Subscription`/`PlanLimits`, `EnsureSubscriptionUseCase`, e o padrão de Checkout que a compra avulsa reaproveita
- [_local-adr-policy-041-campanha-de-fotos-espinha-dorsal-fase-1](041-campanha-de-fotos-espinha-dorsal.md) - Confirma que fotos próprias do usuário nunca chamam geração de imagem por IA, mesmo princípio que isenta o modo `'fixed'` de consumir crédito
