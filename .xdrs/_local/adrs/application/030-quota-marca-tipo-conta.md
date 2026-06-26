---
name: _local-adr-policy-030-quota-de-marca-por-tipo-de-conta
description: Define como o backend aplica o limite de marcas por tipo de conta (pessoal/profissional) e a imutabilidade do accountType. Use ao implementar criação de marca, checagem de plano ou billing.
apply-to: Criação e validação de Brand, checagem de plano de Subscription
valid-from: 2026-06-26
---

# _local-adr-policy-030: Quota de Marca por Tipo de Conta

## Context and Problem Statement

`_local-bdr-policy-009` decide que toda marca tem um `accountType` (`personal` ou `professional`), que conta pessoal é limitada a 1 por usuário, e que profissional escala conforme o plano contratado. É preciso definir onde e como essa regra é aplicada no sistema sem acoplar lógica de cobrança real (ainda não implementada) à criação de marca.

Como aplicar o limite de marcas por tipo de conta de forma que (a) a regra valha mesmo antes de existir gateway de pagamento real, e (b) `accountType` não possa ser usado para contornar a cobrança correta?

## Decision Outcome

**`accountType` é um campo imutável de `Brand`, validado na criação contra uma `Subscription` por usuário que define os limites contratados. Sem `Subscription` registrada, o usuário cai no limite padrão do tier gratuito histórico de transição (1 marca, qualquer tipo) até a Fase de billing ser implementada.**

### Details

**Modelo de dados**

- `Brand` (`packages/domain/src/entities/Brand.ts`) ganha o campo `accountType: 'personal' | 'professional'`.
- Novo tipo `AccountType` em `packages/domain/src/entities/AccountType.ts`.
- Nova entidade `Subscription` (`packages/domain/src/entities/Subscription.ts`): `userId`, `tier`, `maxPersonalBrands` (sempre 1, fixo), `maxProfessionalBrands`.
- `accountType` não está presente em `updateBrandSchema` (`apps/api/src/routes/brands.routes.ts`) — `PATCH /brands/:id` não aceita alterá-lo.

**Checagem de quota**

- `POST /brands` valida `accountType` no corpo da requisição (zod) e, antes de `save`, conta marcas existentes do usuário por tipo e compara com os limites da `Subscription` ativa (ou os limites padrão de transição, se nenhuma existir).
- Exceder o limite não retorna erro genérico — retorna código específico (`brand_limit_reached`) com o tipo de conta afetado, para o frontend acionar o fluxo de upsell em vez de uma tela de erro.
- `ensureDefaultBrand` (criação tardia de marca padrão para usuário sem nenhuma marca) marca a marca padrão criada como `professional`, preservando o comportamento atual de quem já usa o sistema antes desta mudança.

**Imutabilidade**

- `accountType` é decidido apenas na criação. Nenhuma rota de atualização o aceita. Trocar o tipo de uma marca exige, por desenho, criar uma nova marca e migrar os dados — não há endpoint de conversão.
- Exclusão de marca `personal` é bloqueada quando é a única marca ativa do usuário (mesma proteção que já deveria valer para a marca padrão histórica).

**Fora de escopo desta decisão**

- Integração com gateway de pagamento real para popular/atualizar `Subscription` — fica para uma policy de implementação futura quando o billing for desenhado.
- Os sinais e limiares de nudge de upgrade descritos em `_local-bdr-policy-009` — esta ADR cobre apenas o limite rígido de quota, não a sugestão de upgrade por padrão de uso.

## Consequences

- Toda criação de marca passa a depender de uma leitura de `Subscription`, mesmo que ela ainda não tenha cobrança real associada — introduz uma dependência nova no fluxo de `POST /brands`.
- Usuários existentes (pré-multi-marca) continuam com sua única marca classificada como `professional` por causa de `ensureDefaultBrand`, sem necessidade de migração manual de dados.

## References

- [_local-bdr-policy-009-contas-pessoal-profissional-cobranca](../../bdrs/product/009-contas-pessoal-profissional-cobranca.md) - Decisão de negócio que origina esta regra técnica
- [_local-adr-policy-020-firestore-hierarquia-de-sub-documentos](../platform/020-firestore-schema.md) - Hierarquia `users > brands > ...` onde `Brand.accountType` passa a viver
