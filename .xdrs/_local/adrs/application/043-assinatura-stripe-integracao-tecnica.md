---
name: _local-adr-policy-043-assinatura-via-stripe-integracao-tecnica
description: Implementação técnica completa do billing via Stripe — entidade Subscription, PlanLimits como fonte única de verdade dos limites, todos os gates de aplicação por plano (quota de marca, teto de gasto, autonomia, features pagas, retenção de histórico), bypass de admin explícito, tier legado e o webhook do Stripe. Use ao mexer em qualquer gate de plano, no Checkout/Portal/webhook do Stripe, ou em SubscriptionRepository.
apply-to: Billing, Subscription, PlanLimits e todos os gates de plano em apps/api, apps/generator, apps/publisher
valid-from: 2026-11-01
---

# _local-adr-policy-043: Assinatura via Stripe — Integração Técnica

## Context and Problem Statement

`_local-bdr-policy-013` fixa os 4 planos pagos (Grátis, Starter, Pro, Agência) e seus preços.
`_local-adr-policy-030` já tinha desenhado a ideia de uma `Subscription` por usuário e uma
checagem de quota em `POST /brands`, mas nunca foi implementada — toda marca era tratada como
`professional` sem limite nenhum, e não existia nenhuma integração de pagamento no código.

Como implementar billing real de forma que (a) todo gate de plano tenha uma única fonte de
verdade, nunca números hardcoded espalhados; (b) um downgrade de plano (cancelar Pro → cair
pra Starter) valha imediatamente, não só da próxima vez que o usuário resalvar alguma
configuração; (c) `apps/generator` e `apps/publisher`, que não têm e-mail do usuário em
escopo, consigam aplicar os mesmos gates sem reimplementar a lógica de admin; e (d) usuários
que já usavam o produto antes do billing existir não sejam forçados a escolher um plano no dia
do lançamento?

## Decision Outcome

**`Subscription` é uma entidade por usuário, lida por qualquer serviço via
`SubscriptionRepository` (Firestore, `users/{userId}/subscription/current`).
`resolveEffectivePlanLimits(subscription)` é o único ponto de leitura de limites — todo gate
(criação de marca, geração de IA, tick de autonomia, features pagas, histórico) chama essa
função, nunca a tabela `PLAN_LIMITS` diretamente. O bypass de admin é um campo persistido
(`adminOverrideUnlimited`), setado uma única vez na criação do `Subscription`. Stripe Checkout
+ Customer Portal + webhook cobrem o ciclo de vida da assinatura; um tier `legacy` permanente
protege quem já usava o produto antes do corte.**

### Details

**Modelo de dados — `Subscription` e `PlanLimits`**

- `packages/domain/src/entities/Subscription.ts`: `PlanTier = 'legacy' | 'free' | 'starter' |
  'pro' | 'agency'`, `BillingCycle = 'monthly' | 'annual'`,
  `SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'`.
  `Subscription` carrega `userId`, `tier`, `billingCycle`, `status`, `stripeCustomerId`,
  `stripeSubscriptionId`, `additionalProfessionalBrands`, `adminOverrideUnlimited`,
  `trialEndsAt`, `currentPeriodEnd`, `cancelAtPeriodEnd`.
- `packages/domain/src/value-objects/PlanLimits.ts`: tabela `PLAN_LIMITS: Record<PlanTier,
  PlanLimits>` com os valores exatos de `_local-bdr-policy-013` (`includedBrands`,
  `allowedAccountTypes`, `additionalBrandPriceBrl`, `maxAutonomyLevel`,
  `maxAutoPostsPerDayCeiling`, `historyRetentionDays`, `defaultDailyAiSpendingLimitBrl`,
  `allowTikTokVideo`, `allowPhotoCampaigns`, `allowPerformanceAnalytics`).
  `resolveEffectivePlanLimits(subscription)` devolve os limites de `tier`, ou limites
  sintéticos "tudo liberado" (espelhando `legacy`) quando `adminOverrideUnlimited` é `true`.
- **`includedBrands` é `number | null`, nunca `Infinity`** — achado real durante a
  implementação: `JSON.stringify(Infinity)` produz `null`, então um `Infinity` aqui quebraria
  silenciosamente na borda HTTP (`GET /billing/subscription` devolvendo `null` pro frontend de
  qualquer forma, mas por acidente de serialização, não por design). `null` é o próprio valor
  usado de ponta a ponta — domínio, API e frontend concordam no mesmo sentinel.
- `packages/domain/src/ports/SubscriptionRepository.ts`: `findByUserId`, `save`. Implementado
  uma vez por serviço (`apps/api`, `apps/generator`, `apps/publisher`), mesmo padrão de
  duplicação já usado por `BrandProfileRepository` — cada serviço lê Firestore diretamente, sem
  uma chamada HTTP entre serviços pra isso.
- Firestore: `users/{userId}/subscription/current` (documento singleton, id fixo). Regra em
  `firestore.rules`: leitura só pelo dono, escrita sempre `false` (só `api-service` escreve, via
  webhook ou criação preguiçosa).

**Criação preguiçosa e o tier `legacy`**

- `apps/api/src/use-cases/billing/EnsureSubscriptionUseCase.ts` espelha `ensureDefaultBrand`
  (`brands.routes.ts`): se o usuário não tem `Subscription`, cria um na hora. Decide
  `legacy` vs `free` comparando a `createdAt` da marca mais antiga do usuário contra
  `BILLING_CUTOVER_DATE` (constante fixa, `2026-11-01T00:00:00Z` — data do lançamento do
  billing). Marca sem nenhuma, ou mais antiga posterior ao corte → `free`. Alguma marca
  anterior ao corte → `legacy`, permanente, nunca expira (decisão de negócio de
  `_local-bdr-policy-013`).
- `adminOverrideUnlimited: isAdminEmail(userEmail)` é setado **só aqui**, na criação — nunca
  mais sobrescrito (nem pelo webhook do Stripe). É o único lugar do sistema inteiro que
  consulta `isAdminEmail` pra fins de billing: `apps/generator` e `apps/publisher` não têm
  `request.userEmail` em escopo, só `userId`/`brandId`, então eles sempre leem a flag já
  persistida via `resolveEffectivePlanLimits`, nunca reimplementam a checagem de admin.
- `scripts/backfill-legacy-subscriptions.ts` (script único, roda uma vez no deploy): varre
  `collectionGroup('brands')`, agrupa por `userId`, cria `Subscription` `legacy` pra todo
  usuário cuja marca mais antiga é anterior ao corte — evita que o primeiro login de um
  usuário real caia no caminho de criação preguiçosa em produção. Idempotente, suporta
  `--dry-run`. Mesma categoria de tooling que `scripts/inject-x-token.ts` (fora do pipeline de
  build/typecheck do turbo, rodado manualmente via `tsx`).

**Stripe: Checkout, Portal, Webhook**

- `apps/api/src/infrastructure/stripe/stripeClient.ts`: `new Stripe(secretKey)`. O construtor
  do SDK valida a `apiKey` na hora (lança se vazia) — diferente do resto das integrações deste
  projeto. Como `billingRoutes` instancia o cliente na inicialização do app, um ambiente sem
  `STRIPE_SECRET_KEY` (todo teste pré-existente, dev local sem Stripe configurado) quebraria o
  boot do Fastify inteiro sem um fallback — `createStripeClient()` usa
  `'sk_test_placeholder'` quando a env var não está setada.
- `apps/api/src/infrastructure/stripe/priceMapping.ts`: mapeia `(tier, cycle)` → nome da env
  var do price id do Stripe (`STRIPE_PRICE_ID_<TIER>_<CICLO>`) e o inverso (price id → tier +
  cycle), lido em tempo de chamada (não no import) pra testes poderem setar `process.env`
  antes. Única fonte de verdade do mapeamento — usada tanto pelo Checkout quanto pelo webhook.
- `apps/api/src/use-cases/billing/CreateCheckoutSessionUseCase.ts`: cria (ou reaproveita) um
  Stripe Customer, persiste `stripeCustomerId` no `Subscription` na primeira vez, cria a
  Checkout Session (`mode: 'subscription'`, `subscription_data: { trial_period_days: 7 }`,
  `success_url`/`cancel_url` via `resolveWebOrigin` — mesmo helper usado pelas rotas OAuth).
- `apps/api/src/use-cases/billing/CreatePortalSessionUseCase.ts`: `stripe.billingPortal.
  sessions.create(...)`, só precisa do `stripeCustomerId` já persistido.
- `apps/api/src/use-cases/billing/HandleStripeWebhookUseCase.ts`: trata
  `customer.subscription.created/updated` (atualiza tier/ciclo/status/datas a partir do price
  id e do estado real da subscription no Stripe), `customer.subscription.deleted` (devolve pro
  plano `free` — nunca `legacy`, que é exclusivo de quem já usava o produto antes do corte),
  `invoice.payment_failed` (no-op deliberado — o status `past_due`/`unpaid` resultante já
  chega via `customer.subscription.updated` logo em seguida). **Nunca mexe em
  `adminOverrideUnlimited`.**
  - Achado real na implementação: a API atual do Stripe (SDK v23) **não tem mais
    `current_period_end` direto em `Subscription`** — esse campo migrou pra cada
    `SubscriptionItem` (`subscription.items.data[0].current_period_end`). Ler do lugar errado
    teria produzido `undefined` silencioso, não um erro de tipo (o SDK não reclamaria em tempo
    de execução).
- `apps/api/src/routes/billing.routes.ts`: `GET /billing/subscription` (cria/lê + devolve
  `{ subscription, limits }`), `GET /billing/checkout?tier=&cycle=` (devolve `{ url }`, mesmo
  formato JSON-com-URL das rotas de `authorize` do OAuth), `GET /billing/portal`.
- `apps/api/src/routes/stripe-webhook.routes.ts`: **fora** de `app.authenticate` — quem chama
  é o Stripe, não há token Firebase. Verificado manualmente dentro do handler
  (`stripe.webhooks.constructEvent`), mesma forma de `/internal/storage-cleanup-tick`
  (`storage-cleanup.routes.ts`) trocando o segredo compartilhado em header por uma assinatura
  criptográfica. Precisa do **corpo bruto** da requisição — o parser JSON global de `app.ts`
  quebraria a verificação de assinatura — resolvido com
  `app.addContentTypeParser('application/json', { parseAs: 'buffer' }, ...)` registrado dentro
  do encapsulamento deste plugin específico, que por desenho do Fastify nunca vaza pras outras
  rotas JSON do app.

**Gates de aplicação — um por ponto de decisão real**

- **Quota de marcas** (`apps/api/src/routes/brands.routes.ts`, `POST`/`PATCH /brands/:id`):
  resolve `PlanLimits`, valida `accountType` contra `allowedAccountTypes`, conta marcas
  existentes contra `includedBrands + additionalProfessionalBrands`. Estourar devolve
  `409 { error: 'brand_limit_reached', accountType, upgradeTier }` — não um 500/400 genérico.
  Isto finalmente implementa o que `_local-adr-policy-030` descrevia e nunca tinha código. O
  switch pessoal/profissional de `PATCH /brands/:id` (a exceção temporária documentada na
  atualização de 2026-07-22 daquela ADR) continua existindo, mas agora é limitado pelo plano —
  decidido manter o switch (não restaurar imutabilidade total) desde que o `accountType`
  pedido esteja dentro do que o plano atual permite.
- **Teto de gasto diário** (`apps/generator/src/lib/aiSpendingLimit.ts`,
  `resolveEffectiveDailyLimitBrl`): `min(teto salvo na marca, teto do plano)` — `null` de
  qualquer um dos dois lados significa "sem teto desse lado". `GenerateContentUseCase` e
  `EditArtifactUseCase` passam a consultar `SubscriptionRepository` além de `BrandProfile`, e
  recalculam o teto efetivo a cada geração, não só quando o usuário salva a marca — um
  downgrade de plano vale no próximo clique, não na próxima vez que a marca for resalva.
  `apps/api/src/routes/brand-profile.routes.ts` (`PUT`) valida o valor pedido contra o teto do
  plano **na hora de salvar** também, devolvendo `403 { error: 'spending_limit_above_plan' }`
  em vez de aceitar e deixar o valor sem efeito real — erro explícito, não clamp silencioso.
- **Autonomia e posts automáticos** (`apps/publisher/src/use-cases/AutonomyTickUseCase.ts`):
  a cada execução do tick, resolve `PlanLimits` do dono da marca; se `autonomyLevel` da marca
  excede `maxAutonomyLevel` do plano, a tentativa vira `'skipped-plan-limit'` (nova ação no
  histórico do tick — `AutonomyTickAction` em `packages/domain`); `maxAutoPostsPerDay` é
  clampado por `maxAutoPostsPerDayCeiling` antes de checar o slot de horário do dia. Mesma
  validação explícita (não clamp silencioso) em `brand-profile.routes.ts` via
  `isAutonomyLevelWithinPlan`, devolvendo `403 { error: 'autonomy_level_not_in_plan' }`.
- **Features pagas** (vídeo TikTok, campanhas de fotos, dashboard de performance):
  `apps/api/src/middleware/planLimits.middleware.ts` decora
  `app.requirePlanFeature('tiktokVideo' | 'photoCampaigns' | 'performanceAnalytics')`, mesmo
  padrão de `app.authenticate`/`app.requireAdmin`. Aplicado em `POST /campaigns`
  (criação de campanha), `POST /videos/upload` e `POST /videos/compose-slideshow` (o passo pago
  — a *conexão* OAuth do TikTok em si continua liberada, só o pipeline de vídeo é bloqueado), e
  nas 3 rotas de performance (`performance-insights`, `performance-suggestions`,
  `posts-performance`). `403 { error: 'plan_feature_not_included', feature, upgradeTier }`.
- **Retenção de histórico** (`ai-usage.routes.ts`, `autonomy-tick-log.routes.ts`): clamping em
  tempo de **leitura**, não deleção — calcula `since = hoje - historyRetentionDays` e filtra
  os eventos/entradas em memória antes de devolver (mesmo padrão de "volume baixo o
  suficiente" já documentado em `AiUsageReaderPort`). Versões de `BrandProfile` continuam
  guardadas pra sempre, por design (imutáveis, texto barato) — isso é intencional, não um gap
  desta decisão.

**Fechando um gap de rastreamento descoberto durante a implementação**

`groupAiUsageEventsByMonth` (`packages/domain/src/value-objects/AiUsageAggregation.ts`) só
separava `textUsd`/`imageUsd` — com a introdução das categorias `'audio-synthesis'` (TTS, custo
real) e `'video-composition'` (observabilidade, sempre `estimatedCostUsd: 0`) nas classes
Gemini que antes não registravam custo nenhum, qualquer coisa não-texto caía dentro de
`imageUsd` por ser a única outra categoria que existia até então. `AiUsageMonthSummary` ganhou
`audioUsd`/`videoUsd` separados, refletido em `GET /ai-usage` e nas duas telas de gasto
(própria conta e admin).

## Consequences

- Toda geração de IA, criação de marca e tick de autonomia passa a depender de uma leitura de
  `Subscription` — uma dependência nova em cada um desses fluxos, mitigada pelo fail-open já
  documentado no teto de gasto (`subscription` ausente nunca bloqueia, só deixa de aplicar um
  teto extra).
- `PATCH /brands/:id` ainda aceita trocar `accountType` (switch, não imutabilidade total) — se
  isso se provar um vetor de abuso real (declarar `personal` temporariamente pra escapar de um
  limite), a decisão de restaurar imutabilidade total fica registrada como revisão futura desta
  ADR, não desta vez.
- O preço de marca adicional (`additionalBrandPriceBrl`) está modelado no domínio e nas env
  vars do Stripe, mas o fluxo de **comprar** uma marca adicional pela UI (adicionar um item de
  quantidade na assinatura existente) não foi implementado nesta rodada — só a leitura/validação
  de `additionalProfessionalBrands` já contratado. Fica como próximo passo natural.

## Atualização — `defaultDailyAiSpendingLimitBrl` virou `monthlyCreditsIncluded` (2026-11-01)

O campo `PlanLimits.defaultDailyAiSpendingLimitBrl` citado acima (e a trava de gasto diário em
R$ que ele alimentava) foi removido por inteiro, substituído por um saldo de créditos mensal —
ver `_local-adr-policy-044`. `PlanLimits` continua sendo a única fonte de verdade consultada
por todo gate (nada mudou nesse princípio), só o campo específico de custo mudou de forma.

## References

- [_local-bdr-policy-013-planos-precos-e-assinatura](../../bdrs/product/013-planos-precos-assinatura.md) - Decisão de negócio (preços, limites) que esta ADR implementa
- [_local-adr-policy-044-sistema-de-creditos-de-ia](044-sistema-de-creditos-de-ia.md) - Substitui `defaultDailyAiSpendingLimitBrl`/a trava de gasto diário descrita nesta ADR pelo saldo de créditos mensal
- [_local-adr-policy-030-quota-de-marca-por-tipo-de-conta](030-quota-marca-tipo-conta.md) - ADR original de quota de marca, completada por esta
- [_local-adr-policy-020-firestore-hierarquia-de-sub-documentos](../platform/020-firestore-schema.md) - Hierarquia `users > ...` onde `subscription` passa a viver
- [_local-adr-policy-015-firestore-security-rules-implicit-deny](../controls/015-firestore-security-rules.md) - Padrão de regra seguido pela nova subcoleção `subscription`
