---
name: _local-bdr-policy-013-planos-precos-e-assinatura
description: Fixa os 4 planos pagos do SocialShelf (Grátis, Starter, Pro, Agência) com preços em BRL, mensal e anual, e o que cada um cobre — resolve o "Valor a definir" deixado em aberto por _local-bdr-policy-009. Use ao implementar billing, upsell, paywall ou qualquer tela que mostre preço/limite de plano.
apply-to: Modelo de preços, limites por plano e política de upgrade do SocialShelf
valid-from: 2026-11-01
---

# _local-bdr-policy-013: Planos, Preços e Assinatura

## Context and Problem Statement

`_local-bdr-policy-009` já tinha decidido a estrutura de contas (pessoal limitada a 1 por
usuário, profissional escalando em quantidade) mas deixou os valores reais como **"a
definir"** — não havia preço, não havia gateway de pagamento, e qualquer conta nova gerava
conteúdo de IA sem nenhum teto de custo real (`dailyAiSpendingLimitBrl` nasce `null` por
padrão em toda marca).

Isso criava dois problemas simultâneos para abrir o cadastro a terceiros: (1) nenhuma forma de
gerar receita, e (2) nenhuma proteção de custo — o gasto de IA de uma conta nova cai na fatura
do Google Cloud do projeto, não da pessoa.

O usuário pediu explicitamente: "toda roda para pagamento recorrente usando o Stripe [...]
Quero um plano de implementação com valores [...] Precisamos ter várias opção para conseguir
ter opções para vários públicos" — ou seja, não um preço único, mas uma escada de planos
cobrindo desde quem só quer experimentar até agência com várias marcas de clientes.

Como desenhar essa escada de planos de forma que (a) todo uso gere receita ou tenha teto de
custo protegido, (b) o preço escale com o uso real (marcas, automação, features pesadas —
vídeo, campanhas), e (c) exista um caminho natural de upgrade entre os públicos?

## Decision Outcome

**Quatro planos — Grátis, Starter, Pro, Agência — com cobrança mensal e anual (anual com
desconto), 7 dias de teste grátis nos 3 planos pagos, e usuários que já usavam o produto antes
do lançamento do billing ficando num quinto pseudo-plano `legacy`, permanente e ilimitado,
nunca forçados a migrar.**

### A tabela de planos

| | **Grátis** | **Starter** | **Pro** | **Agência** |
|---|---|---|---|---|
| Preço mensal | R$0 | R$29 | R$97 | a partir de R$249 |
| Preço anual | — | R$290 (≈R$24,17/mês) | R$970 (≈R$80,83/mês) | a partir de R$2.490 |
| Público-alvo | experimentar | pessoa física, 1 marca própria | pequeno negócio que quer automação | agência com marcas de clientes |
| Marcas incluídas | 1 pessoal | 1 pessoal | 1 profissional | 3 profissionais |
| Marca profissional adicional | — | — | +R$79/mês | +R$69/mês (desconto de volume) |
| Nível de autonomia máximo | manual | manual ou semi-automático | automático (até 2 posts/dia) | automático (até 3 posts/dia/marca) |
| Redes sociais | todas as 5 | todas as 5 | todas as 5 | todas as 5 |
| Vídeo para TikTok | não | não | sim | sim |
| Campanhas de fotos | não | não | sim | sim |
| Dashboard de performance | não | não | sim | sim |
| Histórico (ticks, gastos de IA) | 7 dias | 30 dias | 180 dias | 1 ano |
| Teto de gasto diário de IA | R$5 | R$15 | R$50 | R$100/marca |
| Teste grátis | — | 7 dias | 7 dias | 7 dias |

### Details

**Por que essa escada específica**

- **Grátis** existe pra ser a forma de experimentar — substitui o "cadastro aberto sem
  cobrança nenhuma" de hoje, mas com teto de custo real (R$5/dia) em vez de ilimitado.
- **Starter** é o primeiro degrau pago, mirado em quem cuida da própria marca sozinho — ainda
  sem automação total (semi-automático no máximo) nem as features mais caras de operar
  (vídeo, campanhas de fotos), que exigem mais geração de IA por uso.
- **Pro** é onde a automação completa (nível `automatic`) e as features pesadas entram — preço
  calibrado pra cobrir o custo real de operar 1 marca com até 2 posts automáticos/dia.
- **Agência** reconhece que quem administra marcas de terceiros precisa de quantidade, não de
  recursos diferentes — mesmo conjunto de features do Pro, mas 3 marcas incluídas e desconto no
  preço por marca adicional (R$69 vs R$79 do Pro avulso).

**O teto de gasto diário é a proteção de custo real, não a contagem de posts**

O custo de uma geração escala com quantas imagens são produzidas, não com "1 post" — um post
pode ter de 1 a 10 imagens (`MAX_GENERATION_ARTIFACTS`). Por isso cada plano tem um teto de
gasto diário em BRL (reaproveitando o campo `dailyAiSpendingLimitBrl` que já existia, mas
nascia sem valor nenhum) como a trava real de custo, com "até X posts/mês" como promessa
secundária pro usuário entender o que esperar — não a trava de verdade.

**Desconto anual**

~17% — equivalente a "pague 10 meses, leve 12". Mesmo princípio de qualquer SaaS com cobrança
anual: reduz o churn mensal em troca de receita antecipada, sem exigir uma tabela de desconto
própria por plano.

**Teste grátis de 7 dias — só nos pagos, não no Grátis**

O plano Grátis já cumpre o papel de "experimentar sem compromisso" — o trial de 7 dias serve
pra quem já decidiu que quer os recursos pagos (automação completa, vídeo, campanhas) mas
quer confirmar que valem a pena antes da primeira cobrança. Implementado via
`trial_period_days` nativo do Stripe Checkout, não uma lógica própria.

**Usuários existentes ficam no plano `legacy`, permanente**

Decisão explícita do usuário: quem já usa o SocialShelf hoje continua com acesso ilimitado e
gratuito pra sempre, nunca é forçado a escolher um plano pago. `legacy` não é oferecido a
ninguém que se cadastre depois do corte — só existe pra proteger quem já estava usando o
produto antes do billing existir.

## Consequences

- Toda marca passa a ter custo real controlado — mesmo o plano Grátis tem teto de IA, em vez
  do comportamento atual (ilimitado por padrão).
- O sistema precisa de uma entidade `Subscription` real por usuário e de um tier `legacy` que
  não existe nos outros BDRs de conta — ver `_local-adr-policy-043` pra implementação técnica.
- Preços e limites desta tabela são a fonte de verdade — qualquer mudança de valor exige uma
  revisão desta policy, não só um ajuste de código solto.

## Superada — teto de gasto diário em R$ trocado por créditos mensais (2026-11-01)

A linha "Teto de gasto diário de IA" da tabela acima (R$5/R$15/R$50/R$100) **não vale mais**.
Ao revisar o desenho com o usuário, ficou claro que um teto em R$ só protege a conta na
média, não no pior caso — e o pior caso (usuário batendo no teto todo dia do mês) chegava a
15-36× o preço pago, com o risco caindo inteiramente sobre o operador do produto.
`_local-bdr-policy-014` substitui essa linha por um saldo de créditos mensal (1 crédito = 1
imagem) cujo pior caso nunca passa do que foi pago, por desenho. "Vídeo para TikTok" também
saiu da tabela de recursos do Pro/Agência nessa mesma revisão — ver `_local-bdr-policy-014`
pros valores novos e o motivo.

## References

- [_local-bdr-policy-009-contas-pessoal-profissional-cobranca](009-contas-pessoal-profissional-cobranca.md) - Decisão original de modelo de contas que deixou os preços como "a definir"; esta policy fecha essa pendência
- [_local-adr-policy-030-quota-de-marca-por-tipo-de-conta](../../adrs/application/030-quota-marca-tipo-conta.md) - Implementação técnica original da checagem de quota, agora completada por `_local-adr-policy-043`
- [_local-adr-policy-043-assinatura-via-stripe-integracao-tecnica](../../adrs/application/043-assinatura-stripe-integracao-tecnica.md) - Implementação técnica completa desta decisão de preços (Stripe, `PlanLimits`, gates por plano)
- [_local-bdr-policy-014-sistema-de-creditos-e-tiktok-em-breve](014-sistema-de-creditos-tiktok-em-breve.md) - Substitui a linha de teto de gasto diário em R$ desta tabela por créditos mensais; tira "vídeo para TikTok" da vitrine
