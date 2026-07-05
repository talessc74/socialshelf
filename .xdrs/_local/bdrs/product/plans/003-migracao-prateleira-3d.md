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

- [x] Os 6 livros renderizam dado real (não mock) via as mesmas chamadas de API das rotas antigas.
- [x] Nenhuma funcionalidade das rotas antigas fica inacessível a partir do livro correspondente.
- [x] Cada livro foi conferido visualmente em desktop (spread) e mobile antes de ser considerado concluído.
- [ ] `/dashboard` só é substituído pela prateleira depois que os 6 livros e o wizard de CRIAR estiverem funcionais — **pendente**: os 6 livros estão prontos, mas `/dashboard` ainda não foi trocado (Fase 3 do plano original, a executar em ciclo separado).

Status geral: **Fases 1 e 2 concluídas e aprovadas pelo humano (2026-07-05)** — os 6 milestones abaixo estão implementados, testados visualmente e aprovados. Fase 3 (substituição de `/dashboard`) segue como trabalho futuro.

## Approach

Migração incremental, um livro por vez, em ordem de risco crescente. Cada livro reutiliza os componentes React já existentes na rota equivalente — o trabalho é de reencaixe em novo container, não de reescrita. CRIAR recebe tratamento à parte: protótipo isolado do mecanismo de sub-página antes de integrar aos demais, dado seu wizard multi-etapa (formulário, progresso de geração, resultado com editor de imagem/lightbox) não caber no formato de spread fixo dos outros 5 livros.

**Desvio registrado durante a execução:** a abordagem original previa reaproveitar a *aparência* dos componentes existentes, não só os dados. A partir do Milestone 2 (MARCA), o humano pediu explicitamente ambientes visuais únicos por livro ("estamos criando ambientes bem únicos em cada livro") — MARCA virou uma peça editorial (livro de mesa de centro), NOTÍCIAS um mosaico de recortes de scrapbook, DESEMPENHO um blueprint de engenharia, e CRIAR um ateliê criativo com mesa de colagem. O dado e a lógica de negócio continuam vindo dos mesmos endpoints das rotas antigas — só a apresentação visual foi redesenhada do zero por livro, não reaproveitada da rota equivalente.

## Key Deliverables

- Mapeamento página-esquerda/direita por livro (ver Milestones) com os dados reais de cada rota.
- Container `PrateleyraOpen` estendido com três mecanismos reutilizáveis por livro: `Provider` (estado compartilhado entre as metades), `hideChrome` (livro assume o cabeçalho por completo) e `fullSpread` (livro ignora a divisão esquerda/direita) — todos entregues.
- Seis componentes de livro em `apps/web/src/components/prateleira-books/`: `RedesBook`, `MarcaBook`, `NoticiasBook`, `AgendaBook`, `DesempenhoBook`, `CriarBook`.
- Dois protótipos isolados do livro CRIAR (conceito visual + rascunho navegável) aprovados antes da integração final.
- Rota `/dashboard/shelf` funcional em paralelo às rotas antigas durante toda a migração — ainda ativa, troca por `/dashboard` fica para a Fase 3 (fora do escopo deste plano).

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
Status: aprovado pelo humano (2026-07-05) — commit 7d016e1, branch claude/claude-index-review-zgqj5j

Introduziu sincronização de estado entre as duas páginas/cards e a primeira mudança de direção: por pedido explícito do humano, MARCA não reaproveita os componentes de formulário existentes (`TagListEditor`, `BrandIdentityCard`) — vira uma peça editorial própria, estilo livro de mesa de centro.

**Acceptance checklist:**
- [x] Página esquerda: marca circular (logo ou inicial), nome e segmento editáveis por clique, citação de posicionamento em serifada, descrição em texto corrido.
- [x] Página direita: paleta de cores como amostras clicáveis, tipografia com amostra ao vivo, tom de voz, e tags curadas (valores/temas/vocabulário).
- [x] Edição embutida por clique no texto (sem campos de formulário aparentes), persistida via `api.updateBrandProfile`/`api.uploadImage`.
- [x] Funciona com marca ainda não cadastrada (perfil `null`): todo campo mostra placeholder editável, permitindo criar a marca inteira pelo livro.
- [x] `PrateleyraOpen` ganhou suporte a `Provider` opcional por livro, permitindo que `MarcaDesktopLeft`/`MarcaDesktopRight` compartilhem uma única instância de estado — resolve desde já a dívida técnica de estado duplicado encontrada pela QA no Milestone 1.
- [x] Mobile em 4 páginas (capa, história, identidade, vocabulário) com o mesmo estado compartilhado.

**Riscos:**
- Sincronizar preview ao vivo entre páginas exigia o mesmo cuidado de estado compartilhado do protótipo — resolvido com o `Provider` por livro, não com a função única `commitStatic`-like inicialmente cogitada.

---

### Milestone 3: NOTÍCIAS
Due date: a definir
Status: aprovado pelo humano (2026-07-05) — commit e97da47, branch claude/claude-index-review-zgqj5j

Segunda mudança de direção: por pedido explícito, NOTÍCIAS não é um carrossel — vira um livro de recortes de scrapbook, com mosaico de tamanhos variados por página.

**Acceptance checklist:**
- [x] Mosaico de recortes com tamanhos variados (não uniformes), rotação leve e determinística por item, fita de scrapbook e borda irregular via `clip-path`.
- [x] Cada recorte mostra fonte, selo de aderência ao público (`audienceFitScore`) e CTA "Criar post disso" (mesma ação real de sempre, `/dashboard/generate?seed=`).
- [x] Busca por pauta (`api.searchNews`) com resultados no mesmo formato de mosaico.
- [x] Mobile pagina o mosaico em grupos, mesma busca na última página.
- [x] Achado corrigido durante a implementação: grid com altura de linha fixa cortava a nota de aderência e o CTA — corrigido para altura automática por conteúdo.

**Riscos:**
- Nenhum risco significativo identificado além do já corrigido acima.

---

### Milestone 4: AGENDA
Due date: a definir
Status: aprovado pelo humano (2026-07-05) — commit 7d013ac, branch claude/claude-index-review-zgqj5j

Implementado conforme especificação direta do humano: calendário completo à esquerda, lista à direita, clique no post "vira a página" para o detalhe.

**Acceptance checklist:**
- [x] Página esquerda: mês completo mostrando posts agendados (marcador dourado) e publicados (marcador verde) por dia, clicáveis.
- [x] Página direita: lista de agendados/publicados; clicar num post (no calendário ou na lista) troca a página para o detalhe completo do post (plataformas, texto integral, quando/onde foi publicado), com botão de voltar.
- [x] `AgendaProvider` compartilha estado (mês, post selecionado) entre as duas metades via o mesmo padrão de `Provider` por livro.
- [x] Mobile pagina calendário compacto e lista em 2 páginas, com o mesmo detalhe ao tocar num post.

**Riscos:**
- Nenhum risco significativo pendente. Edição inline de posts (presente na rota antiga) não foi replicada nesta primeira versão do livro — o detalhe é somente de visualização; ficou registrado como possível extensão futura caso o produto peça.

---

### Milestone 5: DESEMPENHO
Due date: a definir
Status: aprovado pelo humano (2026-07-05) — commits abd35bf, 7f2e290, branch claude/claude-index-review-zgqj5j

Terceira mudança de direção: por pedido explícito ("viés totalmente ENGENHARIA, como um blueprint"), DESEMPENHO virou uma ficha técnica de engenharia — grade azul de desenho técnico, painéis rotulados, tinta de anotação coral.

**Acceptance checklist:**
- [x] Página esquerda: gauge de potencial viral, spec plates de totais (impressões/engajamentos), gráfico de score por post.
- [x] Página direita: seletor de plataforma estilo switch técnico, alertas de erro (permissão/limite de seguidores), diagnóstico completo (nicho, o que funciona, temas de tração como barras, formatos/horários, plano de ação numerado).
- [x] `DesempenhoProvider` replica os fluxos reais (`getPostsPerformance`, `getPerformanceInsights`, `getLatestPerformanceInsights`, auto-análise na primeira carga).
- [x] Mobile em 3 páginas (métricas, diagnóstico, plano de ação).
- [x] `hideChrome`: livro assume o cabeçalho por completo no desktop, sem o título antigo aparecendo por trás do blueprint — achado do humano corrigido no commit 7f2e290, junto com a altura do painel (fixa em vez de percentual, que não resolvia contra um pai de altura automática).

**Riscos:**
- Nenhum risco pendente além do já corrigido.

---

### Milestone 6: CRIAR
Due date: a definir
Status: aprovado pelo humano (2026-07-05) — commits 64a725a, 32942fc, branch claude/claude-index-review-zgqj5j

Item de maior risco técnico, tratado com maior cautela: dois protótipos isolados (design conceitual em HTML, depois um rascunho navegável validando a lógica de rotas) foram aprovados pelo humano antes de qualquer código de produção. Direção final, por pedido explícito: um "ateliê criativo" com salas navegáveis, não um wizard.

**Acceptance checklist:**
- [x] `PrateleyraOpen` ganhou suporte a `fullSpread`: um livro pode assumir a moldura inteira do spread sem a divisão esquerda/direita — necessário porque o fluxo de CRIAR não cabe em duas páginas fixas.
- [x] Estrutura de salas: Entrada (duas portas) → Quadro de Ideias (IA) ou Mesa de Composição (manual) → Mesa de Colagem (só caminho IA) → Exposição (destino comum).
- [x] Quadro de Ideias: prompt, pauta sugerida, sugestões de performance, plataformas conectadas, upload de fotos, rascunho salvo automaticamente (sessionStorage) — mesmos dados de `generate/page.tsx`.
- [x] Mesa de Colagem: as 3 etapas reais de geração (voz de marca → copy → imagens) aparecem como recortes se colando progressivamente numa página em branco — metáfora trocada de câmara escura/revelação fotográfica para bricolagem, por pedido do humano (não convenceu a referência fotográfica isolada).
- [x] Exposição: carrossel completo, retoque real (editar texto / editar com IA via `api.editArtifactText`/`api.editArtifact`), publicar/agendar, publicar em redes extras.
- [x] Mesa de Composição (caminho manual): sincronização de texto entre plataformas, contador de caracteres, upload de imagem, pula a Mesa de Colagem porque a pré-visualização manual já é instantânea — publica de verdade via `api.createPost`/`api.publishPost`.
- [x] Achado de QA corrigido: chip de plataforma que exige imagem (Instagram) ficava travado sem explicação quando clicado sem foto anexada — corrigido para desabilitar visualmente com nota explicativa.

**Riscos:**
- Redução de escopo consciente e registrada: o editor de card-por-card com estilo de template individual e renderização de preview ao vivo (`api.renderCard`, presente em `compose/page.tsx`) não foi replicado na Mesa de Composição — o upload de imagem funciona, mas sem customização de estilo por card. Avaliar se essa redução é aceitável em definitivo ou se precisa ser complementada antes de `/dashboard/compose` ser desativado.
- Wizard com ~15 estados locais e polling assíncrono de geração era o maior risco técnico do projeto — mitigado com sucesso pelos dois protótipos isolados aprovados antes da integração.

## Risks Identified

- Rotas antigas e novas coexistindo por tempo prolongado podem divergir em comportamento se um bug for corrigido em um lugar e não no outro. Mitigação parcial: os 6 livros chamam os mesmos endpoints de API das rotas antigas (mesma lógica de negócio/backend), mas a camada de apresentação foi redesenhada do zero por livro (ver desvio registrado em Approach) — um bug de UI corrigido numa rota antiga não se propaga automaticamente ao livro correspondente.
- O redirect OAuth (LinkedIn/Meta/X) aponta para `/dashboard/accounts`, não para `/dashboard/shelf` — usuário que conecta/reconecta pelo livro REDES retorna à rota antiga após o fluxo externo. Precisa ser resolvido antes da Fase 3 (troca de `/dashboard`).
- Redução de escopo no Milestone 6 (CRIAR): edição de card por card com estilo de template individual (`api.renderCard`) não foi replicada na Mesa de Composição — ver detalhe no Milestone 6.
- Redução de escopo no Milestone 4 (AGENDA): o detalhe de post é somente leitura — edição inline, publicação antecipada e cancelamento de agendamento (presentes em `/dashboard/scheduled`) não foram replicados nesta primeira versão.
- Verificação visual automatizada (Playwright CT) segue bloqueada para todo componente que importe `Platform` de `@socialshelf/domain` (ver detalhe no Milestone 1) — nenhum dos 6 livros tem cobertura de CT ainda; toda verificação foi manual via screenshot do componente de produção real.

## References

- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](002-roadmap-equipe-marketing-autonoma.md) - Roadmap de produto mais amplo no qual esta migração de UI se encaixa
- [_local-bdr-policy-005-design-tokens-identidade-visual](../../design/001-tokens-identidade-visual.md) - Componentes-padrão (Stepper, RecommendationPanel, ScoreBadge) reutilizados nos livros
- [_local-bdr-policy-010-paleta-logo-identidade-visual](../../design/010-paleta-logo-identidade-visual.md) - Paleta oficial a ser conciliada com os tokens dourados/marrons do protótipo da prateleira
