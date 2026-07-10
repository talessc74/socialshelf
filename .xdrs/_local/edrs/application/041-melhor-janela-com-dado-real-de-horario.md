---
name: _local-edr-policy-041-melhor-janela-com-dado-real-de-horario
description: PostPerformanceSummary passa a carregar publishedAt, e o prompt do diagnóstico de performance recebe o horário real (Brasília) de cada post — antes disso, "bestTimes"/"Melhor janela" era um chute do modelo sem nenhum dado de horário por trás. Use ao mexer no pipeline de diagnóstico de performance ou investigar por que "Melhor janela" parece errada/genérica.
apply-to: packages/domain — PatternAnalyzerPort; apps/generator — GeminiPatternAnalyzer, rota /performance-insights/analyze; apps/api — rota /performance-insights
valid-from: 2026-07-10
---

# _local-edr-policy-041: "Melhor Janela" Com Dado Real de Horário

## Context and Problem Statement

Usuário testando a tela de Performance notou que o campo "Melhor janela" (horário sugerido pra publicar) não refletia nenhum padrão real, mesmo com muitos posts publicados no Instagram. Investigando: `PostPerformanceSummary` (o tipo que alimenta `PatternAnalyzerPort.analyzePatterns`) nunca teve nenhum campo de data/hora — só `platform`, `text`, `metrics`, `score`. O prompt do Gemini (`GeminiPatternAnalyzer.buildPrompt`) já pedia `"bestTimes": [...] "com base nos dados"`, mas os dados enviados nunca incluíam quando cada post foi publicado. O modelo não tinha como calcular isso — só podia chutar algo plausível.

## Decision Outcome

**`PostPerformanceSummary` ganha `publishedAt: Date`; o prompt passa a listar o horário de cada post formatado em horário de Brasília (`America/Sao_Paulo`), e as duas rotas na cadeia (`apps/api` → `apps/generator`) passam a validar e propagar esse campo em vez de descartá-lo.**

### Details

**O campo já existia mais cedo na cadeia — só era descartado no meio do caminho**

`GetPostsPerformanceUseCase` (publisher) já grava `publishedAt` em cada `PostPerformanceEntry` desde sempre, e `ApiPostPerformanceEntry` (web) sempre teve esse campo também. O problema era só nos dois zod schemas que ficam no meio da cadeia (`apps/api/src/routes/performance-insights.routes.ts` e `apps/generator/src/routes/performance-insights.routes.ts`) — como zod descarta por padrão qualquer chave que não está explicitamente no schema, `publishedAt` ia no JSON da requisição mas nunca sobrevivia à validação. Ambos os schemas ganharam `publishedAt: z.string().datetime()`.

**Horário fixo em `America/Sao_Paulo`, não configurável por marca**

O produto já formata datas em `pt-BR` em toda parte (`toLocaleString('pt-BR', ...)`) e não tem nenhum conceito de fuso horário por marca hoje. Calcular "melhor horário" sem fixar um fuso daria um resultado sem sentido (o servidor roda em UTC no Cloud Run) — fixar Brasília é a mesma simplificação implícita que `isGoodTimeNow` (`apps/web/src/app/dashboard/insights/page.tsx`) já faz ao usar `new Date().getHours()` no navegador do usuário, sem nenhuma modelagem de fuso por marca. Fuso configurável por marca fica pra quando isso for um problema real (marca fora do Brasil).

**Formato do prompt: "dia da semana abreviado + HH:MM", não só a hora**

`Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })` — dá pro modelo tanto o dia da semana quanto o horário, então ele pode captar um padrão tipo "posts de sábado de manhã performam melhor" e não só "horário X performa melhor" independente do dia. O schema de saída (`bestTimes: string[]`, formato `"HH:MM"`) não mudou — o modelo continua livre pra devolver só a hora, agora com dado real por trás em vez de chute.

**Erro "sem posts" ficava preso na tela e aparecia em inglês (2026-07-10)** — usuário mandou print mostrando "No published posts with metrics to analyze" (em inglês, sem traduzir) na tela, ao lado de "Posts analisados: 29" — contraditório. Causa: a análise automática (`useEffect` em `page.tsx`) rodava só uma vez por sessão (`hasAutoAnalyzed: boolean`); se essa primeira tentativa falhasse com poucos/zero posts, o erro ficava preso ali pelo resto da sessão mesmo depois de novos posts serem publicados, porque nada disparava uma nova tentativa. Trocado por `analyzedForCount: number | null`, que guarda pra quantos posts a última tentativa rodou — o efeito dispara de novo sempre que `entries.length` muda, então a análise se atualiza sozinha conforme mais posts são publicados na mesma sessão, sem precisar que o usuário clique "Refazer análise" manualmente. A mensagem específica `'No published posts with metrics to analyze'` (string vinda de `AnalyzePerformancePatternsUseCase`, propagada crua por duas camadas de proxy) agora é traduzida na tela antes de exibida.

## What this does not solve

Fuso horário por marca (hoje fixo em Brasília pra todo mundo). Nenhuma indicação na UI de que "Melhor janela" é uma estimativa da IA baseada em poucos posts quando `postsAnalyzed` é baixo — o card mostra o valor com a mesma confiança visual independente da quantidade de dado por trás.

## References

- [_local-edr-policy-040-performance-sem-fetch-duplicado](040-performance-insights-sem-fetch-duplicado.md) - Mesma rota (`apps/api/.../performance-insights.routes.ts`), correção anterior nesta cadeia
