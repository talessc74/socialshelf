---
name: _local-adr-policy-046-protecao-contra-reuso-de-teste-gratis
description: Define como o saldo de créditos do teste grátis de 7 dias passa a ser um teto fixo (20 créditos, desacoplado do tier) e como HandleStripeWebhookUseCase detecta o mesmo cartão sendo reusado em outra conta durante o trial, encerrando o teste na hora via trial_end 'now'. Use ao mexer em PlanLimits (trial), Subscription.cardFingerprint, SubscriptionRepository.findByCardFingerprint, ou no webhook do Stripe.
apply-to: packages/domain (PlanLimits, Subscription, SubscriptionRepository), apps/api (HandleStripeWebhookUseCase, FirestoreSubscriptionRepository), apps/generator e apps/publisher (FirestoreSubscriptionRepository)
valid-from: 2026-11-23
---

# _local-adr-policy-046: Proteção contra Reuso de Teste Grátis

## Context and Problem Statement

`_local-bdr-policy-014` (emenda 2026-11-23) decidiu que o teste grátis de 7 dias deve ter um
teto de créditos fixo e pequeno, desacoplado do tier escolhido, e que o mesmo cartão não deve
conseguir um segundo teste gratuito em outra conta. Essa decisão de produto não cobre como
implementar — onde o teto é aplicado, como o cartão é identificado sem pedir nenhum dado novo
do usuário, e o que acontece quando um reuso é detectado.

Confirmado por investigação: o Checkout do Stripe (`CreateCheckoutSessionUseCase`, modo
`subscription` com `trial_period_days: 7`) já coleta o cartão antes da primeira cobrança via um
`SetupIntent` (não cobra nada durante o trial, mas precisa guardar um método de pagamento pra
cobrar depois) — o dado que identifica "é o mesmo cartão físico" (`card.fingerprint`, um hash
estável do Stripe) já existe nesse fluxo, só não estava sendo lido.

## Decision Outcome

**`resolveEffectivePlanLimits` substitui `monthlyCreditsIncluded` por um teto fixo
(`TRIAL_CREDITS_ALLOWANCE = 20`) sempre que `subscription.status === 'trialing'`, independente
do tier. `HandleStripeWebhookUseCase.applySubscriptionUpdate` lê o fingerprint do cartão via
`stripeSubscription.pending_setup_intent` na primeira vez que vê cada assinatura em trial; se o
mesmo fingerprint já apareceu em outro `userId` que também passou por um trial, chama
`stripe.subscriptions.update(id, { trial_end: 'now' })`, encerrando o teste e cobrando o cartão
na hora.**

### Details

**Teto de créditos do trial — `packages/domain/src/value-objects/PlanLimits.ts`**

```ts
export const TRIAL_CREDITS_ALLOWANCE = 20

export function resolveEffectivePlanLimits(subscription: Subscription): PlanLimits {
  if (subscription.adminOverrideUnlimited) return unlimitedPlanLimitsFor(subscription.tier)
  const base = PLAN_LIMITS[subscription.tier]
  if (subscription.status === 'trialing' && base.monthlyCreditsIncluded !== null) {
    return { ...base, monthlyCreditsIncluded: TRIAL_CREDITS_ALLOWANCE }
  }
  return base
}
```

Único ponto de leitura de limites do sistema (já estabelecido antes desta ADR) — todo gate que
já consultava `resolveEffectivePlanLimits` (geração de conteúdo, autonomia, features pagas)
herda o teto de trial automaticamente, sem precisar checar `status` em cada call site. Só
`monthlyCreditsIncluded` muda durante o trial — autonomia, marcas incluídas e features pagas do
tier real continuam valendo, porque o ponto a proteger é custo de IA, não acesso a feature.

**Identificação do cartão — `HandleStripeWebhookUseCase.ts`**

A resolução do fingerprint só roda quando `existing.cardFingerprint` ainda não foi salvo —
depois da primeira vez vira no-op, mesmo que `customer.subscription.updated` dispare dezenas de
vezes ao longo da vida da assinatura:

```ts
const cardFingerprint = existing.cardFingerprint ?? (await this.guardAgainstReusedTrial(stripeSubscription, existing.userId))
```

`guardAgainstReusedTrial` retorna `null` imediatamente (sem nenhuma chamada ao Stripe) quando
`status !== 'trialing'` — a grande maioria dos eventos de uma assinatura normal (renovação,
mudança de cartão, cancelamento) nunca toca este código. Quando é trial, lê
`pending_setup_intent` (string | SetupIntent | null — expandido via
`stripe.setupIntents.retrieve(id, { expand: ['payment_method'] })`), extrai
`payment_method.card.fingerprint`, e consulta `SubscriptionRepository.findByCardFingerprint`
(collection group query sobre `users/*/subscription`, índice declarado em
`firestore.indexes.json`). Reuso é definido como: existe outra Subscription, de outro `userId`,
com `trialEndsAt !== null` (ou seja, já passou por um trial, não importa o status atual).

**O que acontece no reuso**: `stripe.subscriptions.update(subscriptionId, { trial_end: 'now' })`
— a API do Stripe aceita o valor especial `'now'` pra encerrar o trial imediatamente, o que
dispara a primeira cobrança real na hora. Não há bloqueio de cadastro nem mensagem de erro — a
conta nova funciona normalmente, só não ganha o período grátis.

**Limitação conhecida, aceita por desenho**: um cartão virtual descartável (ex.: alguns bancos
oferecem "número de cartão de uso único") gera um fingerprint novo a cada uso, então não é
pego por este mecanismo. Isso existe em qualquer proteção baseada em fingerprint de cartão, não
é uma lacuna de implementação — mitigação completa exigiria fricção adicional (verificação de
telefone, fingerprint de dispositivo), deliberadamente fora de escopo até a métrica de abandono
de teste (ver "Consequences") mostrar abuso real.

**Por que `cardFingerprint` é opcional no tipo `Subscription`**

`cardFingerprint?: string | null` em vez de obrigatório — evita precisar editar os ~20 arquivos
de teste existentes que já constroem literais de `Subscription` sem esse campo. Em todo código
de produção que lê o campo, o valor ausente é normalizado pra `null` (nunca `undefined`), tanto
na leitura do Firestore (`fromFirestore`) quanto na gravação (`cardFingerprint:
subscription.cardFingerprint ?? null`, porque Firestore rejeita `undefined` em `.set()`).

## Consequences

- `SubscriptionRepository` ganha um terceiro método (`findByCardFingerprint`) — as 3
  implementações Firestore (api/generator/publisher) precisam implementá-lo mesmo que só
  `apps/api` (dono do webhook) o use de verdade, mesmo padrão de duplicação já aceito pelo
  projeto pra esse repositório.
- Novo índice collection-group (`subscription.cardFingerprint`) em `firestore.indexes.json` —
  sem ele, `findByCardFingerprint` falha em produção (collection group queries exigem índice
  explícito mesmo pra campo único).
- Nenhuma métrica de monitoramento (taxa de abandono de teste, contagem de fingerprints
  repetidos) foi implementada nesta ADR — ficou documentada como recomendação futura, a ativar
  se a proteção ativa sozinha não for suficiente.

## Conflicts

Nenhum identificado. Estende `_local-adr-policy-044` (sistema de créditos) e
`_local-adr-policy-043` (integração Stripe) sem alterar nenhum dos dois.

## References

- [_local-bdr-policy-014-sistema-de-creditos-e-tiktok-em-breve](../../bdrs/product/014-sistema-de-creditos-tiktok-em-breve.md) - Decisão de produto (emenda 2026-11-23) que esta ADR implementa
- [_local-adr-policy-044-sistema-de-creditos-de-ia](../application/044-sistema-de-creditos-de-ia.md) - CreditBalance e `resolveEffectiveCreditState`, consumidor de `monthlyCreditsIncluded`
- [_local-adr-policy-043-assinatura-via-stripe-integracao-tecnica](../application/043-assinatura-stripe-integracao-tecnica.md) - `HandleStripeWebhookUseCase`, Checkout e trial que esta ADR estende
