---
name: _local-bdr-policy-014-sistema-de-creditos-e-tiktok-em-breve
description: Substitui o teto de gasto diário em R$ por um saldo de créditos mensal (1 crédito = 1 imagem), com os pacotes por plano e a venda de créditos avulsos. Também tira TikTok e X (Twitter) da vitrine de planos — ficam como "em breve", bloqueados por falta de CNPJ. Use ao mexer em preço/limite de plano, saldo de créditos, ou na vitrine de planos.
apply-to: Modelo de controle de custo de IA e vitrine comercial do SocialShelf
valid-from: 2026-11-01
---

# _local-bdr-policy-014: Sistema de Créditos e TikTok "Em Breve"

## Context and Problem Statement

`_local-bdr-policy-013` fixou os preços dos 4 planos com um teto de gasto diário em R$ por
plano como proteção de custo. Ao revisar esse desenho com o usuário, ficou claro um problema
estrutural: um teto em R$ só protege a conta **na média** — nada impede um usuário de bater
no teto todo santo dia do mês, e nos planos Pro/Agência isso nem é um caso raro, é
literalmente a entrega prometida ("automação completa, todo dia"). Nos números originais, o
pior caso de um único usuário custava de 15× a 36× o que ele pagava.

A pergunta do usuário foi direta: *"Por que o risco de pagar a conta cai em mim, o
desenvolvedor, em vez de nas possibilidades que o usuário realmente tem?"* — e a resposta
honesta foi que o teto diário tinha sido calibrado para "parecer generoso", sem checar contra
o custo real por imagem nem contra o preço cobrado.

Separadamente, ao desenhar como mostrar o custo de uma campanha de fotos (que usa as fotos do
próprio usuário, não gera imagem nova por IA), surgiu a proposta do usuário: em vez de um
limite solto em R$, criar uma **medida fictícia de crédito**, com o saldo mostrado e
confirmado explicitamente antes de cada geração — e vender créditos extras avulsos pra quem
precisar de mais.

Por fim, ao revisar a vitrine de planos, o usuário apontou que "vídeo para TikTok" está sendo
vendido mas não pode ser usado de verdade hoje: o mesmo bloqueio de CNPJ que já impede o app
da Meta de passar por App Review (`_local-bdr-policy-012`) also trava o TikTok — a integração
existe e foi testada, mas não há acesso de produção real.

## Decision Outcome

**O teto de gasto diário em R$ é substituído por um saldo de créditos mensal — 1 crédito = 1
imagem gerada por IA (R$0,22, o custo real) — que zera e repõe todo mês, nunca acumula, e é
mostrado e confirmado explicitamente antes de cada geração. Créditos avulsos podem ser
comprados à parte, não expiram, e são usados só depois que o saldo do plano no mês acaba.
"Vídeo para TikTok" sai da vitrine de planos agora, fica marcado como recurso futuro sem data
prometida.**

### A tabela de créditos por plano

| | **Grátis** | **Starter** | **Pro** | **Agência** |
|---|---|---|---|---|
| Preço mensal | R$0 | R$29 | R$97 | R$249 |
| Créditos de IA/mês | 30 | 100 | 200 | 600 (saldo único da conta, não por marca) |
| Pior caso no mês (créditos × R$0,22) | R$6,60 | R$22 | R$44 | R$132 |
| % do preço pago | — (custo de aquisição aceito) | 76% | 45% | 53% |

Diferente do teto em R$ antigo, **o pior caso de cada plano agora é sempre menor ou igual ao
que foi vendido** — não por sorte estatística de "a maioria não vai bater no teto todo dia",
mas porque o saldo tem um fim fixo por desenho. Isso vale tanto pra 1 usuário quanto pra
1.000: como cada usuário paga sua própria fatia e custa sua própria fatia, limitar o pior
caso individual ao que ele paga também limita o pior caso agregado — a soma de custos nunca
passa a soma de receitas.

### Créditos avulsos

**R$0,30/crédito** (acima do custo real de R$0,22, cobrindo taxa do Stripe e margem), vendido
em 3 pacotes: **50 créditos (R$15) · 150 créditos (R$45) · 400 créditos (R$120)**. Mesmo
preço por crédito em qualquer pacote — sem desconto por volume, pra não criar incentivo de
comprar sempre avulso em vez de assinar um plano maior.

### Por que isso resolve o problema sem matar o recurso

A automação (Pro: até 2 posts/dia; Agência: até 3 posts/dia/marca) continua existindo dentro
do orçamento calculado — a implementação técnica (`_local-adr-policy-044`) limita quantas
imagens uma publicação **automática** (sem ninguém revisando antes) pode usar, separado do
que uma composição manual pode gastar, pra a automação caber no saldo sem precisar de um
crédito folgado demais. O Starter é o caso mais apertado (76% do preço no pior caso) porque
R$29/mês é pouco pra sustentar até automação semi-supervisionada com margem folgada — aceito
como realidade de um plano de entrada de ticket baixo, não um problema a resolver agora.

### TikTok — "em breve", sem data

- "Vídeo para TikTok" sai da lista de recursos vendidos/precificados em todos os planos.
- Aparece na vitrine com um selo discreto "Em breve" — igual à linguagem usual de "produto em
  desenvolvimento, pode ser lançado no futuro", sem compromisso de prazo.
- A conexão OAuth com o TikTok em Contas **continua existindo** — só a promessa de vídeo sai
  da vitrine, nada é escondido do produto.
- Contas legado/admin mantêm acesso técnico (usadas pra validar o pipeline enquanto o
  bloqueio de CNPJ não é resolvido) — não é um recurso vendido a ninguém, só acesso de teste.

## Atualização — X (Twitter) entra no mesmo bloqueio (2026-11-01)

O usuário confirmou que a conexão do X também exige CNPJ pra ser válida — mesma natureza do
bloqueio do TikTok e do Meta, não um problema técnico diferente. Decisão: X sai da vitrine
junto com o TikTok, mesmo tratamento.

A vitrine de planos (`apps/web/.../billing/plans/page.tsx`) tinha um defeito específico que
esta atualização corrige: a linha "Todas as 5 redes sociais" (presente em todo plano, inclusive
Grátis/Starter) contava o TikTok como disponível mesmo com "Vídeo para TikTok" já marcado "em
breve" só no Pro/Agência — como TikTok só publica vídeo (`_local-bdr-policy-003`), ele já
estava, na prática, 100% indisponível em todo plano, só que a vitrine não deixava isso claro
fora dos dois planos pagos. Corrigido: toda a vitrine agora lista as redes realmente
disponíveis hoje (LinkedIn, Instagram, Facebook) como recurso, e "TikTok e X (Twitter)" como
"em breve" — um selo só, consistente em todo plano, em vez de uma linha genérica "5 redes" que
não refletia a realidade.

## Atualização 2026-11-23 — revisão de preços após análise de margem no pior caso

Uma análise de custo/margem por plano (assumindo o assinante usar 100% dos créditos do mês,
o pior caso real) revelou dois problemas que esta emenda corrige: (1) o Starter anual não
tinha margem nenhuma no pior caso, e (2) o teste grátis de 7 dias dava o saldo cheio do tier
escolhido, sem teto próprio — alguém podia testar direto o Agência (até 600 créditos, R$129,60
de custo) e cancelar antes da cobrança, nunca pagando nada.

**Validação com dado real**: convertendo o histórico de gasto de IA de uma marca real em
produção (1 carrossel de 3 a 5 imagens/dia, uso comum, não abuso) pelo custo de R$0,216/crédito,
o consumo mensal real variou entre ~86 e ~114 créditos — ou seja, um uso completamente normal já
bate ou passa o teto de 100 créditos do Starter na maioria dos meses. Isso confirma que "pior
caso = 100% dos créditos" não é um cenário hipotético de abuso — é o que uma conta comum já faz
hoje.

### O que muda

| | **Grátis** | **Starter** | **Pro** | **Agência** |
|---|---|---|---|---|
| Preço mensal | R$0 | ~~R$29~~ **R$39** | R$97 (sem mudança) | R$249 (sem mudança) |
| Preço anual | — | ~~R$290~~ **R$390** (≈R$32,50/mês) | R$970 (sem mudança) | R$2.490 (sem mudança) |
| Créditos de IA/mês | ~~30~~ **15** | 100 (sem mudança) | 200 (sem mudança) | 600 (sem mudança) |
| Pior caso no mês (créditos × R$0,216 + taxa Stripe) | R$3,99 (custo de aquisição aceito) | ~R$25 (mensal) / ~R$24 (anual) | ~R$50 | ~R$149 |

- **Grátis (30 → 15 créditos)**: é custo puro, sem receita nenhuma, e sem limite de quantas
  contas a mesma pessoa cria (não pede cartão) — cortar pela metade reduz o prejuízo recorrente
  garantido por conta sem matar o "experimentar".
- **Starter (R$29 → R$39/mês, R$290 → R$390/ano)**: o Pro e o Agência já tinham margem saudável
  (40%+ no pior caso); só o Starter precisava subir pra sair de margem zero/negativa no anual.
- **Avulso (R$0,30 → R$0,35/crédito)**: a margem do pacote avulso (~21-24%) era bem mais fina
  que a da assinatura (~40%+), criando um desvio onde contornar a própria assinatura via avulso
  saía mais barato pra entregar do que deveria.
- **Teste grátis ganha um teto fixo de créditos, desacoplado do tier escolhido** (20 créditos,
  igual pra Starter/Pro/Agência) — antes, o saldo do teste era o saldo cheio do tier, e nada
  desincentivava escolher sempre o plano mais caro pra testar. Com um teto fixo, a exposição por
  conta de teste é sempre a mesma, pequena e previsível (~R$4,64), independente do plano
  escolhido. Só depois da primeira cobrança real (status deixa de ser `trialing`) o saldo cheio
  do tier passa a valer. Implementação técnica (incluindo a proteção contra reuso do mesmo
  cartão em múltiplas contas de teste) em `_local-adr-policy-046`.

## Consequences

- O campo de teto configurável por marca (`dailyAiSpendingLimitBrl`) e toda a lógica que o
  aplicava como trava foram removidos — o histórico de gasto em R$ (`/dashboard/ai-usage`)
  continua existindo, mas vira só informativo.
- O sistema precisa de uma entidade `CreditBalance` nova (saldo por usuário, não por marca) e
  de um segundo fluxo de cobrança no Stripe (Checkout em modo pagamento único, não
  assinatura) — ver `_local-adr-policy-044` pra implementação técnica completa.
- Essa tabela de créditos é a fonte de verdade — qualquer mudança de valor exige revisão desta
  policy, não só um ajuste de código solto, mesmo princípio já estabelecido em
  `_local-bdr-policy-013`.

## References

- [_local-bdr-policy-013-planos-precos-e-assinatura](013-planos-precos-assinatura.md) - Tabela de preços original, cuja seção de teto diário em R$ esta policy substitui
- [_local-bdr-policy-012-onboarding-meta-em-modo-de-desenvolvimento](012-onboarding-meta-em-modo-de-desenvolvimento.md) - Mesmo bloqueio de CNPJ que agora também se aplica ao TikTok
- [_local-adr-policy-044-sistema-de-creditos-de-ia](../../adrs/application/044-sistema-de-creditos-de-ia.md) - Implementação técnica completa desta decisão
- [_local-edr-policy-073-trava-diaria-de-gasto-com-ia](../../edrs/application/073-trava-diaria-de-gasto-com-ia.md) - Mecanismo antigo, descontinuado por esta decisão
- [_local-adr-policy-046-protecao-contra-reuso-de-teste-gratis](../../adrs/controls/046-protecao-reuso-teste-gratis.md) - Implementação técnica do teto fixo de créditos de teste e da detecção de reuso de cartão (emenda 2026-11-23)
