---
name: _local-edr-policy-045-badge-de-nivel-de-autonomia-no-dashboard
description: Badge no topo de /dashboard mostrando se a conta está no modo manual, semi-automático ou automático, com atalho para /dashboard/brand. Use ao mexer na tela inicial do dashboard ou em qualquer exibição do BrandProfile.operation.autonomyLevel fora da tela de configuração de marca.
apply-to: apps/web — /dashboard (página inicial)
valid-from: 2026-07-11
---

# _local-edr-policy-045: Badge de Nível de Autonomia no Dashboard

## Context and Problem Statement

`BrandProfile.operation.autonomyLevel` (manual/semi-automático/automático) só era exibido dentro do formulário de `/dashboard/brand` — nenhum outro lugar do produto deixava claro pro usuário como a conta está sendo tratada no momento. Depois de duas rodadas de trabalho no pipeline automático na mesma sessão (visibilidade de rascunhos pendentes, correção do tick de hora em hora), o usuário pediu explicitamente um jeito claro de ver esse estado.

## Decision Outcome

**Badge no cabeçalho da página inicial do dashboard (`/dashboard`), ao lado da saudação — mesmo dado já buscado pela query `brand-profile` existente nessa tela, sem chamada nova — que linka para `/dashboard/brand`, onde o nível pode ser alterado.**

### Details

**Cabeçalho, não um card à parte**

A página inicial é o primeiro lugar que qualquer usuário vê ao entrar — colocar o badge ali, ao lado do "Bom dia, {nome}", responde a pergunta "como minha conta está publicando agora" antes de qualquer scroll, sem exigir navegação. Um card dedicado mais abaixo na página (junto do card de marca/logo, por exemplo) foi considerado, mas ficaria fora da primeira dobra e diluiria a resposta em meio a outras informações.

**Três estados, cores e ícones distintos, reaproveitando a paleta já usada em `_local-edr-policy-038`**

`automatic` usa o mesmo `bg-violet-50 text-violet-700` e o mesmo emoji de robô já usado no selo "Automático" da tela de posts publicados (`PublishedPostCard`) — mesmo conceito, mesma cor, em dois lugares diferentes do produto. `semi-automatic` ganha uma cor nova (`sky`) por não ter um selo equivalente em nenhuma outra tela ainda. `manual` usa tom neutro (`bg-card-2`), já que é o estado "nada de especial acontecendo sozinho".

**Só aparece quando o perfil de marca já existe**

Sem `brandProfile` carregado (marca ainda não configurada), o badge não renderiza — mostrar "Manual" por padrão nesse caso seria inventar um dado que não existe ainda (o formulário de marca nem foi salvo uma vez). O checklist "Primeiros passos" já cobre esse estado ("Configurar identidade de marca" pendente).

**Badge é só leitura + atalho, não um seletor inline**

Clicar no badge leva para `/dashboard/brand`, onde o seletor completo (com as três descrições detalhadas já existentes em `AUTONOMY_OPTIONS`) já vive. Um dropdown de troca rápida direto no dashboard foi descartado — mudar o nível de autonomia é uma decisão que merece o contexto completo da tela de marca (descrição de cada modo, tópicos liberados/bloqueados, teto diário), não um clique impulsivo a partir da tela inicial.

## What this does not solve

Não indica o `maxAutoPostsPerDay` configurado nem quantos posts automáticos já saíram hoje — só o nível (manual/semi-automático/automático) em si. Uma segunda camada de detalhe ("2 de 3 posts automáticos de hoje já publicados") ficaria natural como evolução da seção "Aguardando sua aprovação" já existente em `/dashboard/scheduled` (`_local-edr-policy-038`), não implementada aqui.

## References

- [_local-edr-policy-038-tick-diario-de-autonomia-implementacao](038-tick-autonomia-implementacao.md) - Mesma paleta/emoji do selo "Automático"; contexto do tick de hora em hora que motivou o pedido de visibilidade
