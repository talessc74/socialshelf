---
name: _local-bdr-policy-015-manual-navegavel-do-produto
description: Define a existência de uma página de manual/ajuda navegável dentro do dashboard (/dashboard/manual), complementar ao chat do Selfie, com o conteúdo-base compartilhado entre os dois. Use ao adicionar/alterar conteúdo de ajuda do produto, ou ao mexer em selfieKnowledgeBase.ts ou apps/web/src/app/dashboard/manual/page.tsx.
apply-to: apps/web (página /dashboard/manual, TopNav), apps/generator (selfieKnowledgeBase.ts)
valid-from: 2026-11-25
---

# _local-bdr-policy-015: Manual Navegável do Produto

## Context and Problem Statement

O usuário perguntou se os "manuais" escritos durante a implementação do chat do Selfie
(`_local-bdr-policy-011`, emenda 2026-11-23) estavam disponíveis no site. Não estavam — o termo
"Manual/Guia Visual" usado na época era só linguagem informal descrevendo o conteúdo-base que
virou `SELFIE_KNOWLEDGE_BASE`; nunca existiu um documento ou página separada. O único jeito de
acessar esse conteúdo era indiretamente, perguntando ao Selfie — não havia uma página que desse
pra simplesmente abrir e ler inteira.

Question: o produto deve ter uma página de ajuda navegável, de leitura direta, complementar ao
chat do Selfie (que responde pergunta pontual, não substitui uma referência completa)?

## Decision Outcome

**Sim — `/dashboard/manual`, uma página estática dentro do dashboard (atrás do mesmo login,
sem gate de plano, igual ao chat do Selfie), com o mesmo conteúdo-base do
`SELFIE_KNOWLEDGE_BASE`, reformatado como texto navegável com links reais pras telas do
produto. Link "Manual" adicionado ao `TopNav`.**

### Details

**Por que o conteúdo é duplicado, não compartilhado por um módulo só**

`apps/web` (frontend, Next.js) e `apps/generator` (backend, serviço separado) não têm nenhum
pacote compartilhado além de `packages/domain` (lógica de domínio pura) — não existe hoje um
pacote de "conteúdo"/texto estático reusável entre runtimes diferentes do monorepo. Criar um
pacote novo só pra texto estático seria desproporcional ao problema. Em vez disso, o conteúdo é
duplicado entre `selfieKnowledgeBase.ts` (prompt do Selfie) e `manual/page.tsx` (página), cada
um com um comentário cruzado apontando pro outro — mesmo padrão já aceito no projeto para
`PlanLimits.ts`/`plans/page.tsx` e `priceMapping.ts`/`credits/page.tsx` ("mantido em sincronia
manualmente").

**Por que não é markdown renderizado**

A página é JSX escrito à mão, não um arquivo `.md` interpretado em runtime — os itens do menu
principal viram `<Link>` reais pras telas do produto (ex. clicar em "Contas" no manual navega
pra `/dashboard/accounts`), o que uma renderização de markdown genérica não daria de graça.
Mesmo espírito de outras páginas de conteúdo do dashboard (`billing/plans`, `billing/credits`):
componente React direto, não um pipeline de conteúdo.

**Sem gate de plano, mesmo racional do chat do Selfie**

Ajuda não é uma feature paga — disponível a qualquer tier, incluindo legado e grátis.

**Como se relaciona com o chat do Selfie**: a página cita o Selfie como caminho pra dúvida
específica sobre o estado real da conta (ex. "por que minhas métricas não aparecem?"); o
Selfie, por sua vez, continua respondendo com base no mesmo conteúdo-base, sem referenciar a
página de volta (ele já incorpora o conteúdo, não precisa linkar pra si mesmo).

## Consequences

- Dois arquivos (`selfieKnowledgeBase.ts` e `manual/page.tsx`) precisam ser atualizados juntos
  sempre que o conteúdo de ajuda mudar — risco de divergência aceito conscientemente, mesmo
  tradeoff já existente em outros pares de arquivo do projeto.
- Novo item em `TopNav.NAV_ITEMS` ("Manual") — mais um destino na barra principal de navegação.

## Conflicts

Nenhum identificado. Complementa `_local-bdr-policy-011` (Selfie) sem alterar seu
comportamento — o chat continua existindo exatamente como estava.

## References

- [_local-bdr-policy-011-selfie-assistente-contextual](011-selfie-assistente-contextual.md) - Chat do Selfie, origem do conteúdo-base reaproveitado aqui
- [_local-adr-policy-045-chat-do-selfie-com-gemini](../../adrs/integration/045-selfie-chat-integracao-gemini.md) - `SELFIE_KNOWLEDGE_BASE`, a fonte do conteúdo duplicado nesta página
