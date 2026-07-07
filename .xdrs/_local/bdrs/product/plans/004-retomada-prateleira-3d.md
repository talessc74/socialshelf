# BDR-Plan-004 — Retomada da Prateleira 3D: paridade total, mobile e rollout seguro

- **Status:** rascunho — aguardando validação humana
- **Criado em:** 2026-07-05
- **Antecessor:** BDR-Plan-003 (migração Prateleira 3D — 6 milestones concluídos, revertido de produção em 2026-07-05 via PR #95)
- **Branch de trabalho:** `claude/claude-index-review-zgqj5j` (código íntegro, preservado)
- **Checkpoint de rollback:** branch `checkpoint-prateleira-6-livros-aprovado` (commit `e83bcb5`)

---

## 1. Contexto e lições do rollback

A Prateleira 3D foi mesclada na `main` (PR #93/#94) e revertida no mesmo dia (PR #95)
porque a experiência chegou em produção **desencontrada**: a tela de entrada da
estante não era responsiva no mobile e havia lacunas de funcionalidade em relação
ao site clássico. O dashboard clássico voltou ao ar e está estável.

### Lições incorporadas como regra neste plano

1. **Nenhuma tela é "pronta" sem verificação visual em desktop E mobile** —
   screenshot com o componente de produção real em 1100×900 e 390×844, incluindo
   interações (cliques, rolagem, formulários), não apenas o estado inicial.
2. **Paridade de funcionalidade é critério de bloqueio, não aspiração** — a matriz
   da Seção 3 deve estar 100% fechada (ou cada exceção explicitamente aprovada
   pelo humano) antes de qualquer novo merge na `main`.
3. **Rollout nunca mais direto para a home** — a nova versão entra em produção
   primeiro como rota opt-in, é validada pelo humano em aparelhos reais, e só
   então substitui `/dashboard` (Fase R do plano).
4. **Deploy é observado até o fim** — todo merge na `main` inclui acompanhamento
   do workflow Deploy até `success` e smoke test pós-deploy.

---

## 2. Inventário do site atual (fonte da verdade de paridade)

Levantado do código em 2026-07-05, por rota, com a superfície de API usada:

| Rota | Funcionalidades | APIs |
|---|---|---|
| `/dashboard` (clássico) | Home agregada: resumo da marca, posts agendados próximos, sugestões de desempenho, links rápidos, avisos de OAuth via query params | `getBrandProfile`, `getConnections`, `getPerformanceSuggestions`, `getPosts`, `getPostsPerformance` |
| `/dashboard/brand` | Perfil da marca: identidade, tom, valores, temas, vocabulário, paleta, logo (upload), **upload de documento da marca** | `getBrandProfile`, `updateBrandProfile`, `uploadImage`, `uploadBrandDocument` |
| `/dashboard/accounts` | Conexões: conectar/ver LinkedIn (perfil × página com sub-fluxo de seleção de organização), Meta, X | `getConnections`, `getAuthorizeUrl`, `getLinkedInPageAuthorizeUrl`, `selectLinkedInPage` |
| `/dashboard/generate` | Geração com IA: descrição, texto, plataformas, estilo, aspect ratio, fotos, seed de pauta, edição de artefatos (texto/IA), publicar/agendar, plataformas extras | `generateContent`, `editArtifact`, `editArtifactText`, `createPost`, `publishPost`, `uploadImage`, `getTopicSuggestions`, `getBrandProfile`, `getConnections`, `getImageUrl` |
| `/dashboard/compose` | Composição manual: plataformas, texto sincronizado/por rede, limites de caracteres, **cards de imagem com estilo de template (headline/body/estilo) e render de preview**, repost via `?repostFrom=` | `createPost`, `publishPost`, `uploadImage`, **`renderCard`**, `getPost`, `getConnections`, `getImageUrl` |
| `/dashboard/scheduled` | Lista + calendário; editar agendado (texto por rede, fotos, data), publicar agora, cancelar; publicados com repost | `getPosts`, `updatePost`, `publishPost`, `deletePost`, `uploadImage`, `getImageUrl` |
| `/dashboard/news` | Busca de notícias + carrossel de pautas com fit score | `searchNews`, `getTopicSuggestions` |
| `/dashboard/insights` | **Sugestões de desempenho: viral score, melhor horário (com destaque "agora é a hora"), guardar/remover da prateleira, abas shelved/fresh/news (`?tab=`)** | `getPerformanceSuggestions`, `getShelvedPerformanceSuggestions`, `setPerformanceSuggestionShelved` |
| `/dashboard/performance` | Métricas de posts, análise de insights de desempenho | `getPostsPerformance`, `getPerformanceInsights` |
| Transversal | TopNav: troca de marca, criação de marca, logout; redirects de OAuth para `/dashboard` com avisos em query params; deep links (`?repostFrom=`, `?seed=`, `?tab=`) | — |

---

## 3. Matriz de paridade — estado atual da branch vs. site clássico

Comparação feita por superfície de API e leitura de código (não por memória):

| Livro | Cobre | Paridade | Lacunas identificadas |
|---|---|---|---|
| **AGENDA** | `/scheduled` | ✅ Completa | Editar/reagendar/publicar/cancelar/repostar já implementados (commit `1f35bad`). Pendente: verificação visual **mobile** dos novos painéis de edição e repost |
| **REDES** | `/accounts` | ✅ Completa | Verificar em mobile o sub-fluxo de seleção de página LinkedIn |
| **NOTÍCIAS** | `/news` | ✅ Completa | `searchNews` + `getTopicSuggestions` presentes. CTA aponta para `/dashboard/generate?seed=` (rota antiga) — redirecionar para o livro CRIAR quando o deep-link interno existir (Fase T) |
| **MARCA** | `/brand` | ⚠️ Quase | **Falta `uploadBrandDocument`** (upload de documento de referência da marca) |
| **DESEMPENHO** | `/performance` | ⚠️ Parcial | Cobre métricas e insights. **Não cobre `/insights` inteiro**: sugestões de desempenho (viral score, melhor horário, guardar na prateleira, abas) não existem em nenhum livro |
| **CRIAR** | `/generate` + `/compose` | ⚠️ Parcial | Paridade total com generate. Do compose, **falta `renderCard`**: cards de imagem com estilo de template (headline/body/estilo por card) e preview renderizado. Falta entrada `?repostFrom=` (mitigado: repost existe na AGENDA, mas sem renderização de card) |
| **Estante** (home) | `/dashboard` clássico | ⚠️ Parcial | Responsividade mobile corrigida (commit `82ba33a`). **Faltam**: avisos de OAuth por query param (o clássico exibia banners de sucesso/erro de conexão — hoje se perdem na estante); a home clássica permanece acessível em `/dashboard/classic` como fallback |
| **PrateleyraCorner** | TopNav | ⚠️ Quase | Troca de marca e logout OK. **Verificar criação de nova marca** (se o TopNav oferecia, o corner precisa oferecer) |

**Decisão de arquitetura (proposta):** o conteúdo de `/insights` entra no livro
DESEMPENHO como seção própria ("Caderno de recomendações" dentro do blueprint),
mantendo a divisão 1 livro = 1 domínio. Alternativa: sétimo livro — descartada
por poluir a estante e quebrar a metáfora física atual de 6 volumes.

---

## 4. Fases de implementação

Cada fase termina com: typecheck + lint + testes limpos, verificação visual
desktop E mobile com componentes reais, aprovação explícita do humano, commit na
branch de trabalho. **Nada vai para `main` antes da Fase R.**

### Fase P — Paridade funcional (fechar a matriz da Seção 3)

| # | Item | Livro | Detalhe |
|---|---|---|---|
| P1 | Sugestões de desempenho | DESEMPENHO | Portar `/insights` completo: cards de sugestão com viral score, melhor horário com destaque temporal, guardar/remover da prateleira, separação fresh/shelved. Estética blueprint mantida |
| P2 | Cards com template e preview | CRIAR | Portar do compose: por card de imagem — estilo (`NO_TEXT`, `BOLD_BOTTOM`, `CENTERED_OVERLAY`, `TOP_STRIP`), headline, body, `renderCard` com preview renderizado, estado de re-render quando o conteúdo muda |
| P3 | Upload de documento da marca | MARCA | Portar `uploadBrandDocument` para o ambiente editorial (ex.: "anexos do dossiê") |
| P4 | Criação de marca | Corner | Auditar TopNav; se houver criação de marca, adicionar ao PrateleyraCorner |
| P5 | Avisos de OAuth na estante | Estante | Ler os query params de retorno de OAuth em `/dashboard` e exibir banner/toast na cena da estante (sucesso e erro), com o mesmo `router.replace` de limpeza do clássico |

### Fase M — Mobile completo (auditoria tela a tela)

Protocolo: para cada item, screenshot 390×844 E 414×896 do componente real,
estado inicial + estados de interação (formulário aberto, painel expandido,
erro visível), correção, re-screenshot.

| # | Tela | O que verificar |
|---|---|---|
| M1 | Estante | Já corrigida (escala 0.72 + scroll horizontal com snap) — revalidar com corner aberto e nomes de marca longos |
| M2 | Animação de abertura | Livro de 310×410px numa tela de 390px — verificar corte/estouro; reduzir escala se preciso |
| M3 | AGENDA mobile | Calendário compacto, lista, detalhe, **novos painéis de edição e repost** (não verificados em mobile ainda) |
| M4 | CRIAR mobile | Todas as salas (entrada, ideias, mesa, colagem, exposição) + editor de retoque + novos cards P2 |
| M5 | DESEMPENHO mobile | Blueprint + nova seção P1 |
| M6 | MARCA mobile | Edição inline, upload de logo, novo P3 |
| M7 | NOTÍCIAS mobile | Mosaico de recortes, busca |
| M8 | REDES mobile | Conexões + sub-fluxo LinkedIn página |
| M9 | Corner mobile | Dropdown não estourar viewport; toque fora fecha; alvo de toque ≥ 44px |
| M10 | Transversal | `prefers-reduced-motion` nas animações de abertura/flutuação; performance de render 3D em aparelho modesto (throttling de CPU no teste) |

### Fase T — Integrações transversais

| # | Item | Detalhe |
|---|---|---|
| T1 | Deep links para livros | `/dashboard?livro=agenda` (ou hash) abre o livro direto — pré-requisito para T2–T4 |
| T2 | CTA de NOTÍCIAS → CRIAR | Recorte "usar esta pauta" abre o livro CRIAR com a seed, sem passar pela rota antiga |
| T3 | Redirects de OAuth | `linkedin/meta/x.routes.ts` já apontam para `/dashboard` (ok com P5); `linkedin-page.routes.ts` aponta para `/dashboard/accounts` — decidir: manter (rota viva) ou redirecionar para `/dashboard?livro=redes` |
| T4 | Botão voltar do navegador | Fechar livro aberto em vez de sair da página (history state) |
| T5 | Rotas antigas | Decisão de produto: permanecem acessíveis por URL direta (proposta: sim, indefinidamente, como "modo clássico") |

### Fase R — Rollout seguro (o inverso do que causou o rollback)

| # | Passo | Critério de saída |
|---|---|---|
| R1 | Merge na `main` com a estante em rota **opt-in** (`/dashboard/shelf`), home clássica intocada | Deploy `success` + smoke test |
| R2 | Validação humana em produção: desktop + **celular real** (iOS/Android), todos os 6 livros, fluxos completos (agendar, editar, publicar, repostar, gerar, compor) | Aprovação explícita do humano por escrito |
| R3 | Swap: `/dashboard` → estante; clássico → `/dashboard/classic`; commit isolado e pequeno (só o swap), fácil de reverter | Deploy `success` + humano confirma no ar em desktop e mobile |
| R4 | Observação por período acordado (proposta: 1 semana) com o clássico a um clique | Sem regressões reportadas |
| R5 | (Opcional, decisão futura) aposentar rotas antigas | Nova deliberação |

**Plano de reversão permanente:** cada passo R tem commit isolado; reverter = 
`git revert` do commit do passo + push na `main` (procedimento já exercitado no
PR #95, funcionou em ~6 min de deploy).

---

## 5. Protocolo de verificação obrigatório (todas as fases)

1. `tsc --noEmit` e `next lint` limpos.
2. `vitest run` — sem falhas novas (falha pré-existente conhecida:
   `scheduled/page.test.tsx` com fixture de data fixa `2026-07-01`; corrigi-la
   com `vi.setSystemTime` é item de higiene desta retomada — **item P0**).
3. Verificação visual com componente de produção real via rota preview
   temporária + Chromium headless: 1100×900 e 390×844, estados inicial e de
   interação. Preview e `.env.local` removidos antes do commit.
4. Novos fluxos com mutação (salvar, publicar, repostar) exercitados de ponta a
   ponta no preview com API mockada — clique real, não só render.
5. XDRS e Notion atualizados somente no fechamento de cada fase aprovada.

---

## 6. Riscos

| Risco | Mitigação |
|---|---|
| `renderCard` (P2) é o item mais complexo — estado assíncrono de render por card, invalidação quando headline/body/estilo mudam | Replicar a máquina de estados do compose (`cardSnapshot`) em vez de reinventar; testar re-render no preview |
| Sugestões de desempenho (P1) dependem de dados que só existem com histórico de posts | Preview com mocks de todos os estados: vazio, fresh, shelved, "agora é a hora" |
| Cena 3D pesada em celulares modestos | M10: teste com CPU throttling; fallback estático se necessário |
| Blocker conhecido de Playwright CT (`Platform` de `@socialshelf/domain` importa `node:crypto`) | Manter verificação via preview + headless screenshot, que contorna o problema |
| Falha de teste pré-existente polui todo CI e mascara regressões reais | P0 corrige antes de qualquer outra coisa |

---

## 7. Ordem de execução proposta

```
P0 (higiene do teste flaky)
  → P1..P5 (paridade, um item por aprovação)
  → M1..M10 (auditoria mobile)
  → T1..T5 (integrações)
  → R1..R4 (rollout gradual)
```

Estimativa de granularidade: cada item P/M/T é uma entrega verificável e
aprovável isoladamente, no mesmo ritmo de trabalho dos milestones do Plan-003.
