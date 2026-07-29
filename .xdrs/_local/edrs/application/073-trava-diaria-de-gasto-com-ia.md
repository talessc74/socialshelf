---
name: _local-edr-policy-073-trava-diaria-de-gasto-com-ia-por-conta
description: Cada marca escolhe seu próprio teto diário de gasto com IA (BrandProfileOperation.dailyAiSpendingLimitBrl, em R$, null = sem limite). GenerateContentUseCase e EditArtifactUseCase bloqueiam antes de qualquer chamada de IA quando o gasto do dia (fuso Brasília) já atingiu o teto, com uma mensagem fixa que reaproveita os bindings de erro já existentes na tela — sem trava, apenas alerta no site, e o bloqueio dura até o próximo dia. Nova página /dashboard/ai-usage (própria conta, qualquer usuário autenticado) mostra o histórico real por mês para ajudar a escolher o valor. Use ao mexer em dailyAiSpendingLimitBrl, AiSpendingGuardPort, isAiSpendingLimitReached, ou ao decidir se um novo ponto de chamada de IA precisa entrar sob a mesma trava.
apply-to: packages/domain — value-objects/BrasiliaDate.ts, value-objects/AiPricing.ts (USD_TO_BRL_RATE, convertUsdToBrl, AI_SPENDING_LIMIT_REACHED_MESSAGE), value-objects/AiUsageAggregation.ts, entities/BrandProfile.ts (dailyAiSpendingLimitBrl), ports/AiUsageReaderPort.ts (findByBrand), ports/AiSpendingGuardPort.ts; apps/generator — infrastructure/firestore/brandProfileNormalization.ts, infrastructure/firestore/FirestoreAiUsageRepository.ts (sumCostUsdSince), lib/aiSpendingLimit.ts, use-cases/GenerateContentUseCase.ts, use-cases/EditArtifactUseCase.ts, routes/generation.routes.ts; apps/api — routes/brand-profile.routes.ts, routes/ai-usage.routes.ts, use-cases/ai-usage/GetBrandAiUsageSummaryUseCase.ts, infrastructure/firestore/FirestoreAiUsageReaderRepository.ts (findByBrand); apps/web — app/dashboard/brand/page.tsx, app/dashboard/ai-usage/page.tsx, components/TopNav.tsx, lib/api.ts
valid-from: 2026-07-29
---

# _local-edr-policy-073: Trava diária de gasto com IA por conta

## Context and Problem Statement

`_local-edr-policy-072` deu ao admin uma visão de gasto de TODAS as contas, mas isso não
resolve o pedido original do usuário: cada conta poder controlar (e ver) o próprio gasto,
sem depender de o admin olhar. Pergunta explícita do usuário ao ver a página de admin: "A
parte de custo foi só para minha conta de admin? Não íamos fazer com que o usuário pudesse
controlar seus gastos?"

Resposta confirmada em 3 pontos: (1) tela de gasto por mês escopada à própria marca, (2)
teto diário em R$ escolhido pelo próprio usuário, (3) ao atingir o teto — alerta no site
apenas (sem e-mail, sem infraestrutura de envio hoje) e o bloqueio dura até o próximo dia
(sem override manual no mesmo dia).

## Decision Outcome

**Cada marca ganha um teto diário opcional (`dailyAiSpendingLimitBrl`, R$, `null` = sem
limite) que bloqueia novas gerações de IA quando o gasto do dia já atingiu o valor — o
bloqueio usa os mesmos bindings de erro que a tela já tinha, e uma nova página de leitura
(`/dashboard/ai-usage`) dá à própria conta o mesmo tipo de visão que a página de admin já
dava a todas.**

### Details

**Câmbio e mensagem de bloqueio centralizados no domínio**

`USD_TO_BRL_RATE`/`convertUsdToBrl` (antes duplicado só na página de admin) e
`AI_SPENDING_LIMIT_REACHED_MESSAGE` migraram para `@socialshelf/domain` (`AiPricing.ts`) —
a página de admin passou a importar a mesma constante, eliminando a duplicação. Câmbio
único evita que a exibição (R$) e a trava (R$, calculada a partir do mesmo USD persistido)
divirjam algum dia.

**Custo nunca persiste em R$ — conversão só na hora de checar/exibir**

Mesma filosofia de `_local-edr-policy-071`/`072`: `AiUsageEvent.estimatedCostUsd` continua
em USD. O teto é digitado pelo usuário em R$, mas a comparação com o gasto acumulado do dia
acontece convertendo o teto para USD (ou o gasto para R$) no momento da checagem — nunca
gravando nada em R$.

**Dia = fuso de Brasília, mesma lógica do contador de autonomia**

`brasiliaDateNow`/`startOfBrasiliaDay` (antes privados dentro de
`AutonomyTickUseCase.ts`, publisher-service) migraram para `@socialshelf/domain` —
reaproveitados aqui para definir o início do "dia" usado em `sumCostUsdSince`. Evita ter
duas implementações do mesmo cálculo de fuso divergindo com o tempo.

**Terceiro port, com contrato deliberadamente diferente dos outros dois**

`AiUsageRecorderPort.record()` nunca lança (observabilidade não pode derrubar geração).
`AiUsageReaderPort` (agora com `findByBrand` além de `findAll`) é só leitura para exibição.
O novo `AiSpendingGuardPort.sumCostUsdSince()` PODE lançar — mas quem chama
(`isAiSpendingLimitReached`, `apps/generator/lib/aiSpendingLimit.ts`) captura qualquer erro
e falha aberto (retorna "não bloqueado"). Uma falha transitória de leitura no Firestore não
pode impedir um usuário que legitimamente não atingiu o teto de gerar conteúdo — o risco
assimétrico entre "bloquear por engano" e "deixar passar uma leitura rara" pesa para o
segundo lado.

**Bloqueio o mais cedo possível, reaproveitando o binding de erro já existente**

`GenerateContentUseCase` e `EditArtifactUseCase` checam o teto logo após buscar o
`brandProfile`, antes de qualquer chamada a Gemini/Imagen — nenhum custo é gerado tentando
checar. Quando bloqueado, o request/artifact vira `status: 'failed'` com
`AI_SPENDING_LIMIT_REACHED_MESSAGE` fixo — a mesma mensagem que os bindings `{result.error}`/
`{artifact.error}` já existentes em `apps/web/src/app/dashboard/generate/page.tsx` exibem.
Não foi preciso nenhuma plumbing nova de erro no frontend para o alerta no site pedido pelo
usuário (decisão 3): o mecanismo de exibição já existia, só passou a ser acionado por mais
um motivo.

**Sem override no mesmo dia, por decisão explícita do usuário**

O usuário confirmou "aguarda o próximo dia" em vez de um botão para desbloquear na hora —
não há nenhuma rota ou UI de override; o bloqueio se resolve sozinho na virada do dia em
Brasília, mesmo mecanismo que já reseta o contador diário de autonomia.

**Campo obrigatório (mas nullable) no payload de PUT /brand-profile**

`dailyAiSpendingLimitBrl: z.number().min(0).nullable()` entrou como chave obrigatória do
schema zod (mesmo padrão de `stylePreferences`/`maxAutoPostsPerDay` desde
`_local-edr-policy-064`) — perfis salvos antes desta feature são normalizados para `null`
na leitura (`brandProfileNormalization.ts`), e `apps/web` sempre envia o campo (mesmo que
`null`) ao salvar, para não quebrar com "Invalid request body".

**Nova página de leitura, escopo próprio (não admin)**

`GET /ai-usage` (`apps/api`) usa só `app.authenticate` — nenhum `requireAdmin`, porque
`findByBrand` já escopa à própria marca do token, diferente de `findAll` (admin,
`_local-edr-policy-072`). `GetBrandAiUsageSummaryUseCase` reaproveita a mesma
`groupAiUsageEventsByMonth` (domínio) que a versão admin usa, para as duas nunca
divergirem. Link "Meus Gastos de IA" sempre visível na `TopNav` (qualquer usuário
autenticado) — renomeado o link de admin para "Gastos de IA (todas as contas)" para
diferenciar os dois na navegação.

## What this does not solve

Mesmo recorte de escopo de `_local-edr-policy-071`/`072`: a trava só cobre os 2 pontos de
chamada já instrumentados (`GenerateContentUseCase`, `EditArtifactUseCase`) — os outros ~7
pontos (legenda de campanha, pipeline de pauta, etc.) continuam sem medição nem trava. Não
há e-mail nem qualquer notificação fora do site quando o teto é atingido — decisão explícita
do usuário para esta fase, dado que o projeto não tem hoje infraestrutura de envio de
e-mail. Não há override manual no mesmo dia — também decisão explícita do usuário.

## References

- [_local-edr-policy-071-mensuracao-de-uso-de-ia-fatia-1](071-mensuracao-uso-ia-fatia-1.md) - Base de mensuração (AiUsageEvent, custo em USD) que a trava e a nova tela consomem
- [_local-edr-policy-072-pagina-de-admin-de-gastos-ia](072-pagina-admin-gastos-ia.md) - Página de admin (todas as contas); esta decisão é o equivalente por conta própria, sem gate de admin
- [_local-edr-policy-038-tick-de-autonomia-implementacao](038-tick-autonomia-implementacao.md) - Origem do cálculo de dia em fuso de Brasília, reaproveitado aqui
