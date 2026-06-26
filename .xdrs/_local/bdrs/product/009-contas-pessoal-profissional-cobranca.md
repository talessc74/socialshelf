---
name: _local-bdr-policy-009-contas-pessoal-profissional-cobranca
description: Define o modelo de contas (pessoal e profissional) por usuário e a estrutura de cobrança associada. Use ao implementar criação de marca, billing, limites de plano ou upsell.
apply-to: Modelo de contas, billing e limites de marca por usuário
valid-from: 2026-06-26
---

# _local-bdr-policy-009: Contas Pessoal e Profissional — Modelo de Cobrança

## Context and Problem Statement

O SocialShelf já suporta múltiplas marcas por usuário (`_local-bdr-policy-002`), mas sem distinção de tipo de conta nem modelo de cobrança. O produto precisa gerar receita recorrente sem depender só de doação espontânea, e precisa de uma forma de diferenciar uso individual (uma pessoa cuidando da própria marca) de uso profissional/agência (um administrador cuidando de marcas de terceiros, potencialmente em volume).

Sem essa distinção, dois problemas aparecem: (1) não há como cobrar de forma proporcional ao uso — uma pessoa com uma marca paga o mesmo que uma agência com dez; (2) não há incentivo estrutural para quem usa o produto de forma profissional migrar para um plano que reflita esse uso.

Como estruturar contas e cobrança para que (a) todo uso gere receita, (b) o custo escale com o número de marcas profissionais, e (c) exista um caminho natural de upgrade de pessoal para profissional?

## Decision Outcome

**Toda marca tem um `accountType` fixo definido na criação: `personal` ou `professional`. Ambos são pagos. Pessoal é limitada a 1 por usuário e tem preço de entrada; profissional escala em quantidade, cada marca adicional é um item de cobrança recorrente.**

### Details

**Estrutura de contas**

- Um usuário (`User`) pode ter no máximo **1 marca do tipo `personal`**, sempre.
- Um usuário pode ter **N marcas do tipo `professional`**, limitado pelo plano de cobrança ativo (`Subscription`).
- `accountType` é definido no momento da criação da marca e é **imutável** — não pode ser alterado depois. Isso evita declarar uma marca como pessoal (mais barata) e operar com características profissionais para evitar a cobrança correta.
- Marca do tipo `personal` não pode ser excluída se for a única marca ativa do usuário — todo usuário mantém pelo menos uma marca.

**Cobrança**

- Conta pessoal: preço fixo, mais baixo que profissional. **Valor a definir.**
- Conta profissional: preço por marca adicional. **Valor a definir.**
- `Subscription` por usuário registra os limites contratados (quantas profissionais o plano cobre) — é o "contrato" de quota consultado antes de criar marca nova. Integração de cobrança real (gateway de pagamento) é decisão de implementação futura, fora do escopo desta policy.
- Tentativa de criar marca acima do limite contratado não falha como erro genérico — retorna sinal específico de limite de plano, para a interface oferecer upgrade no mesmo fluxo.

**Sinalização de upgrade (nudge)**

- Uso de uma conta `personal` com características de uso profissional (múltiplas plataformas conectadas simultaneamente, alto volume de posts/mês, agendamento em lote) pode disparar sugestão de upgrade na interface.
- Os sinais e limiares exatos que disparam esse nudge **ainda não foram definidos** — esta policy registra a existência do mecanismo, não os parâmetros.
- O nudge é apenas sugestivo — não bloqueia o uso da conta pessoal dentro do que ela já paga. O único bloqueio rígido é o limite de marcas do plano.

**Casos de uso cobertos**

- Usuário individual cuidando da própria marca: 1 conta pessoal.
- Administrador/agência cuidando de marcas de terceiros: 1 conta pessoal (uso próprio, opcional) + N contas profissionais, uma por cliente administrado — sem necessidade de múltiplos logins no SocialShelf.

## Consequences

- Toda marca passa a ter custo — não existe mais marca gratuita, inclusive a primeira criada por um novo usuário.
- O sistema precisa de uma entidade `Subscription` (ou equivalente) e de checagem de quota no fluxo de criação de marca antes de qualquer cobrança real existir.
- A definição de preço e dos limiares de nudge ficam pendentes de decisão de negócio — implementação não deve assumir valores até que sejam fixados em revisão desta policy.

## References

- [_local-bdr-policy-002-socialshelf-plataforma-e-produto](002-plataforma-produto.md) - Definição original de produto e modelo de marca única por usuário, agora superada pelo suporte multi-marca
- [_local-adr-policy-030-quota-de-marca-por-tipo-de-conta](../../adrs/application/030-quota-marca-tipo-conta.md) - Implementação técnica da checagem de quota e imutabilidade de `accountType`
