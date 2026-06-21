---
name: _local-edr-policy-031-testes-visuais-de-regressao-em-apps-web
description: Define como detectar bugs de layout/CSS reais (overflow, quebra de texto, recorte de imagem) que o jsdom não consegue reproduzir — Playwright Component Testing rodando o mesmo componente em múltiplos viewports, com screenshot baseline por viewport. Use ao criar ou alterar um componente visual em apps/web/src/components que tenha requisito de identidade de marca ou de responsividade, ou ao investigar por que um bug visual passou pelos testes existentes.
apply-to: apps/web — qualquer arquivo *.ct.tsx em src/components; CI em .github/workflows/ci.yml e .github/workflows/visual-baselines.yml
valid-from: 2026-06-21
---

# _local-edr-policy-031: Testes Visuais de Regressão em apps/web

## Context and Problem Statement

[_local-edr-policy-030](030-testes-componente-web.md) define Vitest + Testing Library com ambiente jsdom para `apps/web`. jsdom não tem motor de layout real: não calcula CSS box model, não aplica `flex`/`grid`, não mede largura de texto. Um teste jsdom pode confirmar que um texto está no DOM, mas não pode detectar que esse texto vaza visualmente do container.

Esse limite se provou concreto: `BrandIdentityCard` vazava texto longo (nome de marca, posicionamento) do card no mobile — um bug de overflow real, em produção, que toda a suíte de componente (jsdom) considerou "passando" porque o texto estava presente no DOM, só não media onde ele terminava na tela. A galera de design (AETHER, COMPASS) e o usuário levantaram a questão diretamente: como os testes não cuidaram disso, e como garantir que decisões de identidade visual e de UX sejam verificadas automaticamente, não só revisadas manualmente depois do bug aparecer?

Como cobrir, de forma automatizada e em CI, exatamente a classe de bug que jsdom estruturalmente não alcança — sem duplicar a suíte de comportamento já coberta por Vitest?

## Decision Outcome

**Playwright Component Testing (`@playwright/experimental-ct-react`) para componentes com requisito visual/de marca, rodando em Chromium real, com screenshot baseline por breakpoint.**

```typescript
// apps/web/playwright-ct.config.ts
const VIEWPORTS = {
  mobile: { width: 375, height: 700 },
  tablet: { width: 700, height: 800 },
  desktop: { width: 1280, height: 900 },
}
// 3 projects, um por viewport — mesmo teste roda 3x, uma screenshot baseline por combinação
```

### Details

**Viewports cobrem os breakpoints Tailwind já usados no código, não valores arbitrários**

`mobile` (375px) fica abaixo de `sm:` (640px), `tablet` (700px) fica acima de `sm:` e abaixo de `lg:` (1024px), `desktop` (1280px) fica acima de `lg:`. São exatamente os três estados de layout que `dashboard/layout.tsx` e `BrandIdentityCard.tsx` alternam via `sm:flex-row`/`lg:grid-cols-4` — o teste verifica o comportamento real do breakpoint usado em produção, não um tamanho de tela genérico.

**Asserção de overflow é geométrica, não apenas screenshot**

Antes do `toHaveScreenshot()`, o teste mede `getBoundingClientRect()` de todo descendente do componente e falha explicitamente se algum elemento ultrapassar a borda direita do container. Isso torna a causa do bug (overflow) uma asserção nomeada e legível na falha do teste, em vez de depender só de um diff de pixels para apontar "algo mudou" sem dizer o quê.

**Screenshot baseline cobre o resíduo que a asserção geométrica não nomeia**

Cor, espaçamento, alinhamento e recorte de imagem não têm uma asserção geométrica simples; o diff de pixel contra baseline é o que pega regressão nesses atributos.

**Componente testado sem rede — fixture estática, sem `logoStoragePath`**

`BrandIdentityCard.ct.tsx` monta o componente com uma fixture de `ApiBrandProfile` fixa, com `logoStoragePath: null`, reproduzindo o estado "Sem logo". Isso evita qualquer dependência de Firebase Storage real ou mock de rede — o mesmo princípio de isolamento de [_local-edr-policy-030](030-testes-componente-web.md), adaptado para um ambiente de browser real em vez de jsdom.

**Geração de baseline é uma ação humana deliberada, não automática no merge**

`toHaveScreenshot()` falha (não passa silenciosamente) quando não existe baseline. Gerar/atualizar baseline é um job manual (`workflow_dispatch`) em `.github/workflows/visual-baselines.yml`, separado do job de verificação (`visual-regression` em `ci.yml`). Isso impede que uma regressão visual real "vire baseline" por acidente durante um merge — alguém precisa rodar a action e revisar o diff de imagem antes de aceitar a nova baseline.

**Job de CI roda em paralelo a `build`, não bloqueia o pipeline existente**

`visual-regression` depende de `test` (mesmo gate de `build`), mas não é dependência de `build`/`docker-build-check`. Falha visual é sinalizada (PR vermelho, artefato `playwright-report` com o diff) sem travar o pipeline de deploy de outras mudanças não relacionadas a UI — decisão alinhada a manter `_local-edr-policy-005` (pipeline sequencial) restrito a gates que sempre devem bloquear.

## What this does not solve

Testes visuais de páginas inteiras autenticadas (Dashboard, Configurar Marca) — exigiriam mock ou emulador de Firebase Auth dentro do Chromium real, fora do escopo desta primeira cobertura. Cobertura atual é por componente, começando por `BrandIdentityCard` (origem do bug que motivou esta decisão); expandir para outros componentes de marca/identidade visual é trabalho subsequente, não automático.

## References

- [_local-edr-policy-030-testes-de-componente-em-apps-web](030-testes-componente-web.md) - Testes de comportamento (jsdom) que esta decisão complementa, não substitui
- [_local-edr-policy-005-ci-pipeline](../devops/005-ci-pipeline.md) - Pipeline sequencial onde o job `visual-regression` se insere
- [_local-bdr-policy-005-design-tokens-identidade-visual](../../bdrs/design/001-tokens-identidade-visual.md) - Identidade de marca que a cobertura visual existe para proteger
