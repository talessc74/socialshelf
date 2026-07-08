# BDR-Plan-004 — Retomada da Prateleira 3D: compatibilidade total (desktop + mobile)

- **Status:** rascunho v2 (detalhado) — aguardando validação humana
- **Criado em:** 2026-07-05 · **Revisado em:** 2026-07-05
- **Antecessor:** BDR-Plan-003 (6 milestones concluídos; revertido de produção via PR #95)
- **Branch de trabalho:** `claude/claude-index-review-zgqj5j`
- **Checkpoint de rollback:** branch `checkpoint-prateleira-6-livros-aprovado` (commit `e83bcb5`)

---

## 0. Princípio regente

> **O SocialShelf migrará integralmente para a versão de prateleira e livros.**
> Toda funcionalidade do site atual deve ter uma "página" compatível dentro dos
> livros — no desktop e no mobile. Toda função de backend consumida pelo site
> atual deve ser consumida pela nova visão. Compatibilidade total é critério de
> bloqueio para o merge, não meta aspiracional.

Este documento é a fonte da verdade dessa compatibilidade. Ele decompõe:
(A) a superfície completa de backend; (B) cada página do site atual, função por
função, com o endereço exato de destino na nova versão (livro → página do livro
→ página mobile); (C) a especificação mobile; (D) as fases de execução com
critérios de aceite por item.

Todo o inventário abaixo foi levantado **do código** em 2026-07-05 (grep da
superfície `api.*` em `apps/web/src`), não de memória.

---

## A. Superfície de backend — 31 funções, cobertura obrigatória

Legenda: ✅ já consumida pela nova versão · ❌ falta portar · ⚠️ situação especial

| # | Função de backend | Consumidor no site atual | Destino na nova versão | Status |
|---|---|---|---|---|
| 1 | `getBrands` | `BrandContext` (global) | Inalterado — contexto global alimenta o `PrateleyraCorner` | ✅ |
| 2 | `getConnections` | accounts, compose, generate | REDES (lista), CRIAR (plataformas), AGENDA (repost) | ✅ |
| 3 | `getAuthorizeUrl` | accounts | REDES → conectar LinkedIn/Meta/X | ✅ |
| 4 | `getLinkedInPageAuthorizeUrl` | accounts | REDES → conectar página LinkedIn | ✅ |
| 5 | `getLinkedInPagePendingSelection` | accounts (retorno OAuth `?linkedinPagePending=`) | REDES — **o retorno por query param precisa abrir o livro REDES já no seletor de organização** (item T3) | ❌ |
| 6 | `selectLinkedInPage` | accounts | REDES → escolher organização | ✅ |
| 7 | `createPost` | compose, generate | CRIAR (publicar/agendar), AGENDA (repost) | ✅ |
| 8 | `publishPost` | compose, generate, scheduled | CRIAR, AGENDA | ✅ |
| 9 | `updatePost` | scheduled | AGENDA → editar agendado | ✅ |
| 10 | `deletePost` | scheduled | AGENDA → cancelar agendamento | ✅ |
| 11 | `getPosts` | scheduled, classic | AGENDA (calendário + listas) | ✅ |
| 12 | `getPost` | compose (`?repostFrom=`) | CRIAR → entrada de repost com pré-preenchimento (item P2c) | ❌ |
| 13 | `getAudienceSignal` | **nenhum** (sem consumidor no front atual) | Confirmar com backend se é órfã; se viva, candidata ao DESEMPENHO | ⚠️ P6 |
| 14 | `getTopicSuggestions` | generate, NewsCarousel | NOTÍCIAS (mosaico), CRIAR (sala de ideias) | ✅ |
| 15 | `searchNews` | NewsSearch | NOTÍCIAS (busca) | ✅ |
| 16 | `getPerformanceSuggestions` | insights, classic (painel) | DESEMPENHO → seção Recomendações (item P1) | ❌ |
| 17 | `submitPerformanceSuggestionFeedback` | `PerformanceSuggestionsPanel` (classic) | DESEMPENHO → Recomendações: útil/não útil (item P1) | ❌ |
| 18 | `setPerformanceSuggestionShelved` | insights | DESEMPENHO → guardar/remover da estante (item P1) | ❌ |
| 19 | `getShelvedPerformanceSuggestions` | insights (aba shelved) | DESEMPENHO → Recomendações guardadas (item P1) | ❌ |
| 20 | `getBrandProfile` | brand, generate, classic | MARCA, CRIAR | ✅ |
| 21 | `updateBrandProfile` | brand | MARCA (edição inline) | ✅ |
| 22 | `uploadImage` | brand, compose, generate, scheduled | MARCA (logo), CRIAR (fotos), AGENDA (fotos na edição) | ✅ |
| 23 | `uploadBrandDocument` | brand (seção "Documento da marca") | MARCA → anexo do dossiê com extração automática (item P3) | ❌ |
| 24 | `generateContent` | generate | CRIAR → Mesa de Colagem | ✅ |
| 25 | `getGenerationRequest` | **nenhum** (geração retorna completa; sem polling no front) | Confirmar se órfã; se o backend tornar a geração assíncrona, entra no CRIAR | ⚠️ P6 |
| 26 | `editArtifact` | generate (retocar com IA) | CRIAR → editor de retoque | ✅ |
| 27 | `editArtifactText` | generate (editar texto do card) | CRIAR → editor de retoque | ✅ |
| 28 | `getPostsPerformance` | performance, classic | DESEMPENHO (blueprint de métricas) | ✅ |
| 29 | `getPerformanceInsights` | performance | DESEMPENHO (diagnóstico) | ✅ |
| 30 | `getLatestPerformanceInsights` | **nenhum** no front atual | Confirmar se órfã (cache de diagnóstico); se viva, DESEMPENHO usa para evitar re-análise a cada abertura | ⚠️ P6 |
| 31 | `getImageUrl` | compose, generate, scheduled, LogoImage | CRIAR ✅ · **AGENDA ❌ (mostra "N imagem(ns)" em texto; o site atual mostra miniaturas reais)** → item P4 | parcial |
| 32 | `renderCard` | compose (cards com template) | CRIAR → Mesa de Composição com cards estilizados (item P2) | ❌ |

**Resumo:** 22 funções já portadas · 7 faltando (`getLinkedInPagePendingSelection`
no fluxo de retorno, `getPost`/repost, as 4 de sugestões de desempenho,
`uploadBrandDocument`, `renderCard`, e `getImageUrl` na AGENDA) · 3 sem
consumidor no front atual, a confirmar com o backend (P6) para decidir portar
ou registrar como órfãs.

---

## B. Decomposição página a página — endereço de cada função na nova versão

Convenção de endereços:
- **Desktop:** `LIVRO › página` (páginas do spread; um livro pode ter vários
  spreads navegáveis com "virar página").
- **Mobile:** `LIVRO › card N` (sequência de cards navegável por
  anterior/próxima, padrão já existente).

### B1. Home `/dashboard` (clássica, 397 linhas) → Estante

| Função no site atual | Endereço novo (desktop) | Endereço novo (mobile) | Status |
|---|---|---|---|
| Saudação + resumo da marca ativa (`getBrandProfile`) | A estante É a home; identidade da marca aparece no `PrateleyraCorner` | Idem | ✅ decidido no Plan-003 |
| Estatísticas (BigStat/StatPill: posts, engajamento) + `EngagementGauge` | DESEMPENHO › página 1 (blueprint já cobre) | DESEMPENHO › card 1 | ✅ coberto |
| Próximos agendados (`getPosts`) | AGENDA › calendário/lista | AGENDA › cards 1-2 | ✅ coberto |
| Painel de sugestões (`PerformanceSuggestionsPanel` com feedback útil/não útil) | DESEMPENHO › página Recomendações (**P1**) | DESEMPENHO › card Recomendações (**P1**) | ❌ |
| Atalhos para as rotas | Os próprios livros na estante | Idem | ✅ por construção |
| Avisos OAuth (`?connected=`, `?error=`, `?detail=`) com banner e `router.replace` de limpeza | Banner na cena da estante (**P5**) | Banner na estante mobile (**P5**) | ❌ |
| `?linkedinPagePending=` → abre seletor de organização LinkedIn | Estante abre automaticamente REDES no seletor (**T3**) | Idem (**T3**) | ❌ |

### B2. `/dashboard/brand` (489 linhas, 7 seções) → livro MARCA

O formulário atual tem 7 seções; o livro MARCA (estética "livro de mesa de
centro" com edição inline `EditableText`/`TagRow`/`LogoMark`) precisa endereçar
**todas**:

| Seção do site atual | Campos/funções | Endereço desktop | Endereço mobile | Status |
|---|---|---|---|---|
| Documento da marca | `uploadBrandDocument` → extração automática preenche o perfil | MARCA › página "Dossiê & anexos" (**P3**) | MARCA › card Dossiê (**P3**) | ❌ |
| Negócio | descrição, segmento, público | MARCA › spread 1 | MARCA › card 1 | ✅ verificar campo a campo em P3 |
| Identidade | nome, valores (TagListEditor), temas | MARCA › spread 1 | MARCA › card 1-2 | ✅ verificar |
| Visual | paleta de cores, logo (`uploadImage`) | MARCA › spread 2 | MARCA › card 2 | ✅ verificar |
| Voz | tom, vocabulário preferido/proibido (2× TagListEditor) | MARCA › spread 2 | MARCA › card 3 | ✅ verificar |
| Narrativa | história/posicionamento | MARCA › spread 2 | MARCA › card 3 | ✅ verificar |
| Operação | frequência, horários, plataformas-alvo | MARCA › spread 3 (**P3b — auditar presença**) | MARCA › card 4 | ⚠️ auditar |
| Salvar (`updateBrandProfile`) com estado novo-perfil (`profile === null`) | Já implementado (salvar por campo, inline) | Idem | ✅ |

**Regra de aceite MARCA:** diff campo a campo entre `ApiBrandProfile` completo e
os campos editáveis no livro; nenhum campo do tipo pode ficar sem lugar de edição.

### B3. `/dashboard/accounts` (212 linhas) → livro REDES

| Função | Endereço desktop | Endereço mobile | Status |
|---|---|---|---|
| Lista de conexões com status (`getConnections`) | REDES › página esquerda | REDES › card 1 | ✅ |
| Conectar LinkedIn perfil / Meta / X (`getAuthorizeUrl`) | REDES › página direita | REDES › card 2 | ✅ |
| Conectar página LinkedIn (`getLinkedInPageAuthorizeUrl`) | REDES › página direita | REDES › card 2 | ✅ |
| Seletor de organização no retorno (`getLinkedInPagePendingSelection` + `selectLinkedInPage`) | REDES › painel seletor — **precisa abrir via query param na estante** (**T3**) | Idem | ⚠️ código existe, gatilho de abertura não |
| Banners de sucesso/erro pós-OAuth | Estante (**P5**) + dentro do livro | Idem | ❌ |

### B4. `/dashboard/generate` (1315 linhas) → livro CRIAR, trilha IA

Stepper atual: `Descrever → Gerando → Resultado`. Mapeamento sala a sala do ateliê:

| Função | Endereço desktop | Endereço mobile | Status |
|---|---|---|---|
| Formulário: descrição, texto pronto opcional, plataformas, estilo de template, aspect ratio, fotos (`uploadImage`) | CRIAR › Sala Mesa (trilha IA) | CRIAR › Mesa (mobile) | ✅ |
| Seed de pauta (`getTopicSuggestions`, `?seed=`) | CRIAR › Sala de Ideias | CRIAR › Ideias | ✅ (deep-link externo em **T2**) |
| Rascunho persistente (sessionStorage `socialshelf:criar-atelie-draft`) | CRIAR (global do livro) | Idem | ✅ |
| Geração (`generateContent`) com estágios visíveis | CRIAR › Mesa de Colagem | Idem | ✅ |
| Resultado: cards por plataforma, lightbox de imagem | CRIAR › Sala de Exposição | Exposição (mobile) | ✅ (lightbox: auditar em M4) |
| Retoque: editar texto (`editArtifactText`) e editar com IA (`editArtifact`) — modos menu/instrução/texto | CRIAR › Editor de retoque | Idem | ✅ |
| Publicar agora / agendar (`createPost` + `publishPost`) | CRIAR › Exposição | Idem | ✅ |
| Plataformas extras pós-publicação (publicar o mesmo conteúdo em redes adicionais, com resultados/falhas parciais) | CRIAR › Exposição | Idem | ✅ (auditar estados de falha parcial em M4) |
| Aviso de mídia por plataforma (`PLATFORM_MEDIA_NOTE`, Instagram exige imagem) | CRIAR › Mesa | Idem | ✅ |

### B5. `/dashboard/compose` (706 linhas) → livro CRIAR, trilha manual

| Função | Endereço desktop | Endereço mobile | Status |
|---|---|---|---|
| Seleção de plataformas com estados: conectada / em breve (X) / bloqueada sem imagem | CRIAR › Mesa (trilha manual) | Idem | ✅ |
| Texto sincronizado ↔ por plataforma, limites de caracteres com contador de cor | CRIAR › Mesa | Idem | ✅ |
| **Cards de imagem com template**: por card — estilo (`NO_TEXT`/`BOLD_BOTTOM`/`CENTERED_OVERLAY`/`TOP_STRIP`), headline, body, preview renderizado (`renderCard`), invalidação/re-render quando o conteúdo muda (`cardSnapshot`), estados carregando/erro por card, limite `MAX_GENERATION_ARTIFACTS` | CRIAR › Mesa, painel de cards (**P2**) | CRIAR › Mesa mobile, cards empilhados (**P2**) | ❌ |
| Repost (`?repostFrom=` + `getPost`): pré-preenche plataformas, textos, sincronização detectada, imagens existentes | CRIAR › entrada "repostar" (**P2c**) — e a AGENDA já oferece repost direto simplificado | (**P2c**) | ❌ parcial |
| Publicar agora / agendar com validação de data futura | CRIAR › Mesa/Exposição | Idem | ✅ |
| Resultado com falhas parciais por plataforma | CRIAR › Exposição | Idem | ✅ |

### B6. `/dashboard/scheduled` (556 linhas) → livro AGENDA

| Função | Endereço desktop | Endereço mobile | Status |
|---|---|---|---|
| Visões Lista ↔ Calendário (calendário como padrão, BDR-policy-008) | AGENDA › esquerda calendário, direita lista | AGENDA › card 1 calendário, card 2 lista | ✅ |
| Calendário mensal com navegação de mês, posts no dia (hora + trecho), "+N mais", destaque hoje | AGENDA › esquerda | AGENDA › card 1 (compacto) | ✅ |
| Detalhe do post (plataformas, textos por rede, quando/onde) | AGENDA › direita (vira página) | AGENDA › detalhe | ✅ |
| **Miniaturas das fotos** (`getImageUrl` + `PostThumbnail`) | AGENDA › detalhe e edição — hoje mostra só "N imagem(ns)" em texto (**P4**) | Idem (**P4**) | ❌ |
| Editar agendado: texto por rede com limite, adicionar/remover fotos, reagendar com validação de data futura (`updatePost` + `uploadImage`) | AGENDA › painel de edição | Idem — **verificação mobile pendente (M3)** | ✅ commit `1f35bad` |
| Publicar agora (`publishPost`) | AGENDA › detalhe | Idem | ✅ |
| Cancelar agendamento com confirmação (`deletePost`) | AGENDA › detalhe | Idem | ✅ |
| Repostar publicado (`createPost`+`publishPost`), escolha livre de redes com regras de mídia, texto por plataforma | AGENDA › painel repost | Idem — **verificação mobile pendente (M3)** | ✅ commit `1f35bad` |
| Scroll-para-post com destaque ao vir do calendário | AGENDA › seleção direta no contexto | Idem | ✅ equivalente |

### B7. `/dashboard/news` → livro NOTÍCIAS

| Função | Endereço desktop | Endereço mobile | Status |
|---|---|---|---|
| Busca de notícias (`searchNews`) | NOTÍCIAS › página busca | NOTÍCIAS › card busca | ✅ |
| Pautas com fit score, fonte, thumbnail (favicon fallback — BDR-policy-008), selo de plataforma se já publicada (`getTopicSuggestions`) | NOTÍCIAS › mosaico de recortes | NOTÍCIAS › cards | ✅ (auditar selo de plataforma e favicon fallback em M7) |
| "Usar esta pauta" → gerador com seed | Hoje aponta para rota antiga `/dashboard/generate?seed=` → deve abrir CRIAR › Ideias com a seed (**T2**) | Idem (**T2**) | ❌ |

### B8. `/dashboard/insights` (194 linhas, 3 abas) → livro DESEMPENHO, seção Recomendações (**P1**)

| Função | Endereço desktop | Endereço mobile | Status |
|---|---|---|---|
| Aba "Guardadas" (`getShelvedPerformanceSuggestions`) | DESEMPENHO › página Recomendações, filtro guardadas | DESEMPENHO › card Recomendações | ❌ |
| Aba "Novas" (`getPerformanceSuggestions`) | Idem, filtro novas | Idem | ❌ |
| Aba "Notícias" (`?tab=news`) | Redireciona para o livro NOTÍCIAS (não duplicar conteúdo) — deep-link **T1** | Idem | ❌ |
| Card de sugestão: headline, rationale, viral score (`ScoreBadge`), temas-base | DESEMPENHO › Recomendações | Idem | ❌ |
| Melhor horário com **destaque temporal "agora é a hora"** (`bestTimeWeekdays`/`HourStart`/`HourEnd` vs. relógio) | Idem | Idem | ❌ |
| Guardar/remover da estante (`setPerformanceSuggestionShelved`) | Idem | Idem | ❌ |
| Feedback útil/não útil (`submitPerformanceSuggestionFeedback`) | Idem | Idem | ❌ |

### B9. `/dashboard/performance` (356 linhas) → livro DESEMPENHO

| Função | Endereço desktop | Endereço mobile | Status |
|---|---|---|---|
| Métricas por post (`getPostsPerformance`), tabela/plot por plataforma | DESEMPENHO › blueprint (EngagementPlot, SpecPlate, PlatformSwitch) | DESEMPENHO › cards | ✅ |
| Gráfico de engajamento no tempo (`EngagementOverTimeChart`) | DESEMPENHO › blueprint — **auditar paridade do gráfico** (M5) | Idem | ⚠️ auditar |
| Diagnóstico do perfil (`getPerformanceInsights` + `ProfileDiagnosticPanel`, análise automática na 1ª carga) | DESEMPENHO › página diagnóstico | DESEMPENHO › card | ✅ |
| Viral score gauge | DESEMPENHO › ViralGauge | Idem | ✅ |

### B10. Transversais (fora de rota)

| Função | Situação atual | Endereço novo | Status |
|---|---|---|---|
| TopNav: troca de marca, e-mail, logout | `PrateleyraCorner` | Estante (canto sup. direito) | ✅ verificado |
| TopNav: criação de marca | **Não existe no site atual** (auditado: TopNav não tem) | Nada a portar; registrar | ✅ n/a |
| Guard de autenticação + spinner de loading | `dashboard/layout.tsx` mantém para todas as rotas | Inalterado | ✅ |
| Botão voltar do navegador com livro aberto | — | Fecha o livro (history state) (**T4**) | ❌ |
| Deep-link para livro (`/dashboard?livro=X`) | — | Necessário para T2/T3/B8-news (**T1**) | ❌ |
| Rotas antigas | Vivas | Permanecem acessíveis por URL como "modo clássico" durante a transição (**T5** confirma política) | decisão |

---

## C. Especificação mobile (todas as telas)

Padrões obrigatórios, aplicados em **todas** as telas da nova versão:

1. **Viewports de referência:** 390×844 (base) e 414×896; sem overflow
   horizontal do body em nenhuma tela.
2. **Estante:** livros a 0.72×, fileira com scroll horizontal + snap-center,
   rótulos acompanham (já implementado — commit `82ba33a`); título reduzido;
   corner não sobrepõe livros.
3. **Animação de abertura:** volume 3D de 310×410px deve caber com folga —
   escalar para ≤ 78% da largura do viewport (**M2**).
4. **Livro aberto (card mobile):** navegação anterior/próxima já padronizada;
   cada livro define sua sequência de cards (mapeada na Seção B); painéis novos
   (edição AGENDA, repost, Recomendações, cards com template) entram como
   estados dentro do card, com botão voltar contextual.
5. **Alvos de toque ≥ 44×44px** em chips de plataforma, dots do calendário,
   botões de página.
6. **Teclado móvel:** formulários (edição AGENDA, Mesa do CRIAR, MARCA) não
   podem ficar sob o teclado — verificar com viewport encolhida na altura.
7. **`prefers-reduced-motion`:** desativa flutuação do livro e abertura 3D
   (corte direto para o livro aberto) (**M10**).
8. **Desempenho:** cena da estante testada com CPU throttling 4× no Chromium
   headless; se travar, fallback com sombras/blurs reduzidos (**M10**).

---

## D. Fases de execução

Cada item termina com: typecheck + lint + testes limpos; verificação visual
desktop (1100×900) E mobile (390×844) com o componente de produção real,
estados inicial + interação + erro; aprovação humana; commit. **Nada vai para
`main` antes da fase R.** XDRS/Notion atualizados só no fechamento de fase.

### P0 — Higiene (pré-requisito de tudo)
- Corrigir `scheduled/page.test.tsx` com `vi.setSystemTime` (fixture de data
  fixa que envenena o CI e mascara regressões reais).
- **Aceite:** `vitest run` 100% verde no repositório inteiro.

### P — Paridade funcional (fecha as células ❌ da Seção B)

| Item | Escopo | Funções de backend exercitadas | Aceite |
|---|---|---|---|
| P1 | DESEMPENHO › seção Recomendações: cards de sugestão (headline, rationale, ScoreBadge, temas), melhor horário com destaque "agora é a hora", guardar/remover da estante, feedback útil/não útil, filtros novas/guardadas — estética blueprint | 16, 17, 18, 19 | Todos os estados (vazio, novas, guardadas, "agora") verificados no preview desktop+mobile; mutações clicadas de ponta a ponta |
| P2 | CRIAR › cards com template na Mesa manual: estilo/headline/body por card, `renderCard` com preview, invalidação por `cardSnapshot`, estados carregando/erro por card, limite de artefatos | 32, 22, 31 | Card renderiza, re-renderiza ao editar, erro por card exibido; paridade com compose confirmada lado a lado |
| P2c | CRIAR › entrada de repost: `?repostFrom=`/deep-link interno pré-preenche plataformas, textos, sincronização e imagens | 12 | Repost de post real mockado pré-preenche idêntico ao compose |
| P3 | MARCA › página "Dossiê": `uploadBrandDocument` com extração preenchendo o perfil + **auditoria campo a campo** das 7 seções (Negócio, Identidade, Visual, Voz, Narrativa, Operação, Documento) vs. `ApiBrandProfile` | 23, 21 | Diff de campos = vazio; upload extrai e preenche no preview |
| P4 | AGENDA › miniaturas reais de fotos no detalhe e na edição (`getImageUrl` + PostThumbnail) | 31 | Miniaturas visíveis nos dois modos, desktop e mobile |
| P5 | Estante › avisos OAuth: banners de `?connected=`/`?error=`/`?detail=` com limpeza de URL, na cena da estante desktop e mobile | — | Simulação dos 3 params no preview exibe banner correto e limpa a URL |
| P6 | Auditoria das 3 funções sem consumidor (`getAudienceSignal`, `getGenerationRequest`, `getLatestPerformanceInsights`): confirmar com o backend se são órfãs ou pendentes de consumo; portar as vivas (candidato: `getLatestPerformanceInsights` como cache do diagnóstico no DESEMPENHO) | 13, 25, 30 | Cada uma com decisão registrada: portada ou declarada órfã |

### M — Auditoria mobile (tela a tela, contra a Seção C)

| Item | Tela | Verificações específicas |
|---|---|---|
| M1 | Estante | Revalidar com corner aberto, nome de marca longo, 390 e 414px |
| M2 | Animação de abertura | Escala ≤78% do viewport; reduced-motion corta a animação |
| M3 | AGENDA | Calendário, lista, detalhe, edição (P4 incluída), repost — com teclado aberto |
| M4 | CRIAR | 5 salas + retoque + lightbox + cards P2 + falhas parciais de publicação |
| M5 | DESEMPENHO | Blueprint + gráfico de engajamento + Recomendações P1 |
| M6 | MARCA | 7 seções + dossiê P3 + upload de logo |
| M7 | NOTÍCIAS | Mosaico, busca, selo de plataforma, favicon fallback |
| M8 | REDES | Conexões + seletor de organização LinkedIn |
| M9 | Corner | Dropdown dentro do viewport; toque-fora fecha; alvos ≥44px |
| M10 | Transversal | reduced-motion global; CPU throttling 4×; overflow horizontal zero em todas |

### T — Integrações transversais

| Item | Escopo | Aceite |
|---|---|---|
| T1 | Deep-link `/dashboard?livro=<id>` abre o livro direto (estante monta já aberta) | URL direta abre cada um dos 6 livros |
| T2 | NOTÍCIAS "usar pauta" → CRIAR › Ideias com seed, sem sair da estante; aba "news" de insights aponta para o livro NOTÍCIAS | Clique no recorte abre CRIAR com a pauta carregada |
| T3 | Retornos de OAuth: `?linkedinPagePending=` abre REDES no seletor de organização; decidir destino de `linkedin-page.routes.ts` (hoje `/dashboard/accounts`) → proposta: `/dashboard?livro=redes&linkedinPagePending=` | Fluxo completo simulado no preview |
| T4 | Botão voltar fecha o livro aberto (pushState ao abrir, popstate fecha) | Voltar com livro aberto → estante; voltar na estante → sai da página |
| T5 | Política das rotas antigas: permanecem por URL direta como "modo clássico" (sem link na UI nova) durante R1–R4 | Registrado nesta policy; revisão pós-R4 |

### R — Rollout seguro (inverso do que causou o rollback)

| Passo | Ação | Critério de saída |
|---|---|---|
| R1 | Merge na `main` com a estante em rota **opt-in** (`/dashboard/shelf`); home clássica intocada | CI + Deploy `success`; smoke test na rota opt-in |
| R2 | Validação humana em produção: desktop + **celular real** (iOS e Android se possível), 6 livros, fluxos completos: conectar rede, editar marca, gerar, compor com card, agendar, editar agendado, repostar, guardar recomendação | Aprovação explícita do humano por escrito |
| R3 | Swap num commit mínimo e isolado: `/dashboard` → estante; clássico → `/dashboard/classic` | Deploy `success` + humano confirma no ar (desktop e mobile) |
| R4 | Observação por 1 semana com o clássico a um clique | Sem regressões reportadas |
| R5 | (Decisão futura) aposentar rotas antigas | Nova deliberação |

**Reversão:** cada passo R em commit isolado; reverter = `git revert` + push
(procedimento exercitado no PR #95: ~6 min até produção restaurada).

---

## E. Riscos

| Risco | Mitigação |
|---|---|
| P2 (`renderCard`) é o item tecnicamente mais denso: estado assíncrono por card + invalidação | Replicar a máquina de estados do compose (`cardSnapshot`), não reinventar; testar re-render no preview |
| P1 depende de dados que só existem com histórico | Preview com mocks de todos os estados, incluindo "agora é a hora" com relógio controlado |
| Deep-links (T1) mexem no ciclo de fases da estante (shelf/animating/open) | Implementar como estado inicial, sem tocar na máquina de fases existente |
| Cena 3D pesada em aparelho modesto | M10 com throttling; fallback de efeitos |
| Playwright CT bloqueado (`Platform` importa `node:crypto`) | Verificação via preview + Chromium headless (já validada em todo o Plan-003) |
| Falha de teste pré-existente mascara regressões | P0 é pré-requisito de tudo |
| Escopo grande convida a "pular" verificações | Cada item P/M/T é entrega isolada com aprovação própria; a Seção B é o checklist de merge |

---

## F. Ordem de execução

```
P0 → P1 → P2 → P2c → P3 → P4 → P5 → P6   (paridade: fecha a Seção A/B)
   → M1..M10                              (auditoria mobile: fecha a Seção C)
   → T1..T5                               (integrações)
   → R1 → R2 → R3 → R4                    (rollout gradual com validação humana)
```

Critério global de "pronto para R1": todas as células da Seção A com ✅ (ou
órfã registrada em P6), todas as linhas ❌/⚠️ da Seção B resolvidas, todos os
itens M aprovados com screenshots arquivados.
