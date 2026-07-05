# _local-bdr-plan-003: Migração da Home para Prateleira 3D

## Executive Summary

- O SocialShelf substitui o dashboard tradicional (`/dashboard`) por uma experiência de entrada em **prateleira 3D**: seis livros temáticos (AGENDA, NOTÍCIAS, DESEMPENHO, CRIAR, MARCA, REDES) que abrem em spread de duas páginas (desktop) ou em cards flip-clock sequenciais (mobile).
- Cada livro deve espelhar exatamente a funcionalidade já em produção na rota equivalente — nenhum recurso existente pode ser perdido na migração, apenas a casca visual muda.
- O mapeamento página-esquerda/página-direita de cada livro foi levantado a partir do inventário real dos componentes de cada rota (`scheduled`, `news`+`insights`, `performance`, `generate`+`compose`, `brand`, `accounts`).
- CRIAR é o item de maior risco técnico: seu wizard multi-etapa (formulário → geração → resultado com editor de imagem) não cabe em duas páginas fixas e exige um mecanismo de sub-página dentro da mesma moldura do livro aberto.
- Ordem de execução por risco crescente: REDES → MARCA → NOTÍCIAS → AGENDA → DESEMPENHO → CRIAR. Cada livro é construído e conferido nos dois modos (desktop e mobile) antes do próximo avançar.
- Rotas antigas permanecem ativas em paralelo durante a migração — a prateleira nasce como rota nova (`/dashboard/shelf`) e só substitui `/dashboard` na fase final.

## Context and Problem Statement

O protótipo de alta fidelidade da prateleira 3D (aprovado nas iterações v1-v16, tanto desktop quanto mobile) resolveu a estética e a interação, mas usa dados mockados. O produto real tem 9 rotas funcionais sob `/dashboard` com lógica de negócio, estado e integrações já em produção. Sem um plano de mapeamento explícito, a migração corre o risco de recriar a estética sem preservar a funcionalidade, ou de travar no item mais complexo (CRIAR) sem ter avançado nos outros.

## Proposed Solution

Migrar rota por rota para dentro do livro correspondente, reaproveitando os componentes React já existentes (não recriar do zero) dentro dos dois containers de layout: `PrateleyraOpen` (desktop, spread de duas páginas) e o mecanismo flip-clock (mobile, card único em repouso). Cada livro só avança para o próximo depois de validado nos dois modos.

Expected end date: 2027-06-30

## Acceptance Criteria

- [ ] Os 6 livros renderizam dado real (não mock) via as mesmas chamadas de API das rotas antigas.
- [ ] Nenhuma funcionalidade das rotas antigas fica inacessível a partir do livro correspondente.
- [ ] Cada livro foi conferido visualmente em desktop (spread) e mobile (flip-clock) antes de ser considerado concluído.
- [ ] `/dashboard` só é substituído pela prateleira depois que os 6 livros e o wizard de CRIAR estiverem funcionais.

## Approach

Migração incremental, um livro por vez, em ordem de risco crescente. Cada livro reutiliza os componentes React já existentes na rota equivalente — o trabalho é de reencaixe em novo container, não de reescrita. CRIAR recebe tratamento à parte: protótipo isolado do mecanismo de sub-página antes de integrar aos demais, dado seu wizard multi-etapa (formulário, progresso de geração, resultado com editor de imagem/lightbox) não caber no formato de spread fixo dos outros 5 livros.

## Key Deliverables

- Mapeamento página-esquerda/direita por livro (ver Milestones) com os componentes reais de cada rota.
- Container `PrateleyraOpen` (desktop) e container flip-clock (mobile) recebendo os mesmos componentes React, sem duplicar lógica de negócio.
- Protótipo isolado do livro CRIAR (sub-páginas dentro da moldura aberta) antes da integração final.
- Rota `/dashboard/shelf` funcional em paralelo às rotas antigas durante toda a migração.

## Milestones

### Milestone 1: REDES
Due date: a definir
Status: aprovado pelo humano (2026-07-05) — commits 93dd67d, 9f7df80, db7f1e1, 1fae432, 5dd0583, branch claude/claude-index-review-zgqj5j

Livro mais simples — valida o padrão de dado real em página dupla nos dois modos antes de seguir para os demais.

**Acceptance checklist:**
- [x] Página esquerda (desktop): grid de plataformas conectadas primeiro, com o LinkedIn distinguindo Perfil pessoal vs Página quando conectado.
- [x] Página direita (desktop): contagem de redes conectadas e painel de seleção pendente de Página do LinkedIn.
- [x] Mobile: mesmas informações paginadas (2 plataformas por página), conectadas primeiro, navegação anterior/próxima.
- [x] `PrateleyraOpen` ganhou um registro de conteúdo por livro (`BOOK_CONTENT`), preparando o encaixe dos próximos 5 livros sem reescrever o container.
- [x] Ícones reais de plataforma (LinkedIn/Instagram/Facebook/X via lucide-react) substituindo emoji genérico, após feedback visual do humano.
- [x] Verificado visualmente pelo humano em screenshot real (desktop com moldura de spread + lombada; mobile com card único), usando o componente de produção `PrateleyraOpen` diretamente — não uma reimplementação paralela do layout.

**Key tasks:**
- Página esquerda: grid de contas conectadas por plataforma (conectar/desconectar).
- Página direita: fluxo de seleção de página/organização (LinkedIn) + notices de sucesso/erro do redirect OAuth.
- Mobile: grid vira card 1; seletor de página vira card 2 (só aparece quando há pendência).

**Riscos:**
- O redirect OAuth (LinkedIn/Meta/X) está hardcoded no backend para `/dashboard/accounts` (`apps/api/src/routes/oauth/*.routes.ts`), não para `/dashboard/shelf`. Ao conectar/reconectar a partir do livro REDES, o usuário retorna à rota antiga após o fluxo externo, não ao livro. Mitigação futura: parametrizar o redirect de retorno por origem (state OAuth) quando a prateleira substituir `/dashboard` — não bloqueia o Milestone 1 porque a rota antiga permanece ativa em paralelo.
- Deliberação da Galera de QA (PARETO/PROBE/SCAFFOLD) sobre o Milestone 1 encontrou estado duplicado sem sincronização: `RedesDesktopLeft` e `RedesDesktopRight` montam instâncias independentes de `useRedesConnections()`, então um erro de `handleConnect` (disparado em Left) não aparecia em nenhum dos dois lados — falha silenciosa para o usuário. Reparo cirúrgico aplicado (commit db7f1e1): `Left` ganhou sua própria faixa de aviso. Dívida técnica registrada: elevar o estado de conexão para uma única instância compartilhada (contexto) antes do Milestone 2 herdar o mesmo padrão de três montagens independentes do mesmo hook.
- Verificação visual automatizada (Playwright CT) não foi possível para os novos componentes: qualquer componente que importe `Platform` de `@socialshelf/domain` falha ao empacotar no ambiente Vite do `playwright-ct.config.ts`, porque o barrel de exportação do pacote arrasta `PairwiseId.ts` (usa `node:crypto`), que o Rollup não consegue externalizar para o browser. Nenhum CT existente testa esse caminho hoje. Verificação feita via `tsc --noEmit` e `eslint` limpos. Mitigação futura: registrar como EDR a necessidade de isolar o barrel de exports do domain (ou mockar `@socialshelf/domain` no `ctViteConfig`) antes de os próximos livros dependerem de CT para regressão visual.
- Primeira rodada de verificação visual manual usou uma página de preview ad hoc que reimplementava o layout à mão, em vez de montar o componente de produção `PrateleyraOpen` diretamente — o screenshot resultante não refletia a moldura real do livro (sem spread, sem lombada, mobile desalinhado) e quase foi validado como se fosse fiel. Corrigido na segunda rodada montando `<PrateleyraOpen book={...} isMobile={...} />` de verdade. Lição para os próximos milestones: a verificação visual manual de cada livro deve sempre montar o componente de produção real, nunca uma reconstrução paralela do layout só para fins de screenshot.

---

### Milestone 2: MARCA
Due date: a definir

Introduz sincronização de estado entre as duas páginas/cards.

**Key tasks:**
- Página esquerda: formulário completo (nome, tom, tags via `TagListEditor`, cores, autonomia) + upload de documento/logo com extração via IA.
- Página direita: `BrandPostPreview` ao vivo, refletindo mudanças do formulário em tempo real.
- Mobile: formulário vira card 1, preview vira card 2 — atualização em tempo real precisa de estado compartilhado entre cards, não por página local (mesmo padrão de fonte única de verdade já resolvido no protótipo mobile).

**Riscos:**
- Sincronizar preview ao vivo entre card 1 e 2 no mobile exige o mesmo cuidado de estado compartilhado já validado no protótipo — mitigação: reaproveitar o padrão de função única (`commitStatic`-like) como fonte de verdade do estado de marca.

---

### Milestone 3: NOTÍCIAS
Due date: a definir

Componentes já compactos e prontos — baixo risco.

**Key tasks:**
- Página esquerda: `NewsCarousel` (manchetes em destaque, rotação automática).
- Página direita: `NewsSearch` + lista de sugestões (fresh/shelved) com ação de promover a pauta.
- Mobile: carousel vira card 1 (swipe entre manchetes); busca+sugestões vira card 2.

**Riscos:**
- Nenhum risco significativo identificado.

---

### Milestone 4: AGENDA
Due date: a definir

Introduz edição inline complexa (texto por plataforma, fotos, reagendamento).

**Key tasks:**
- Página esquerda: calendário mensal (`CalendarView`) — clique no dia mostra os posts daquele dia.
- Página direita: lista de posts agendados com `PostCard` (edição inline) + `PublishedPostCard` para histórico.
- Mobile: calendário vira card 1 compacto ("próximos 7 dias" em vez de grid completo); lista de posts vira card 2 com scroll.

**Riscos:**
- Edição inline de imagens precisa de espaço; mobile pode precisar de um "modo edição" que expande o card. Mitigação: avaliar expansão temporária do card durante edição ativa, sem quebrar o mecanismo flip-clock em repouso.

---

### Milestone 5: DESEMPENHO
Due date: a definir

Introduz gráficos e múltiplos estados de erro (permissão, limite de seguidores).

**Key tasks:**
- Página esquerda: seletor de plataforma + `ProfileDiagnosticPanel` com `ScoreBadge`s (diagnóstico sob demanda).
- Página direita: `EngagementOverTimeChart` + lista de posts medidos.
- Mobile: diagnóstico vira card 1; gráfico+histórico vira card 2 (gráfico com altura reduzida).

**Riscos:**
- Estados de erro (permissão, limite de seguidores) precisam de espaço visível em ambos os formatos sem quebrar o layout fixo do spread/card. Mitigação: reservar área de mensagem de erro dentro do template de página, não como overlay.

---

### Milestone 6: CRIAR
Due date: a definir

Item de maior risco técnico — wizard multi-etapa não cabe em duas páginas fixas. Depende da validação dos 5 milestones anteriores para reaproveitar o padrão de container já estabilizado.

**Key tasks:**
- Prototipar isoladamente o mecanismo de sub-página dentro da moldura do livro aberto (`page: 0,1,2...`), antes de integrar ao restante.
- Página de entrada do spread: resumo + CTA ("Gerar com IA" / "Post manual").
- Sub-páginas: formulário (`Stepper`, `RecommendationPanel`, `ScoreBadge`) → progresso de geração → resultado com editor de imagem (Lightbox) → compose manual.
- Mobile: cada sub-página vira um card cheio (sem split-flap neste caso — conteúdo denso demais); navegação por avançar/voltar dentro do livro.

**Riscos:**
- Wizard com ~15 estados locais e polling assíncrono de geração é o maior risco técnico do projeto. Mitigação: protótipo isolado aprovado antes de tocar em qualquer código de produção dos outros 5 livros já migrados.

## Risks Identified

- Rotas antigas e novas coexistindo por tempo prolongado podem divergir em comportamento se um bug for corrigido em um lugar e não no outro. Mitigação: cada livro reutiliza o mesmo componente React da rota antiga, nunca uma cópia.
- Sincronização de estado entre páginas/cards (já resolvida uma vez para o mecanismo flip-clock do protótipo) precisa ser revalidada a cada livro que introduzir dado ao vivo compartilhado entre as duas metades (ex: MARCA).

## References

- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](002-roadmap-equipe-marketing-autonoma.md) - Roadmap de produto mais amplo no qual esta migração de UI se encaixa
- [_local-bdr-policy-005-design-tokens-identidade-visual](../../design/001-tokens-identidade-visual.md) - Componentes-padrão (Stepper, RecommendationPanel, ScoreBadge) reutilizados nos livros
- [_local-bdr-policy-010-paleta-logo-identidade-visual](../../design/010-paleta-logo-identidade-visual.md) - Paleta oficial a ser conciliada com os tokens dourados/marrons do protótipo da prateleira
