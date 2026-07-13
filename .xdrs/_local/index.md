# _local Scope Overview

## Visão Geral

Decisões locais do SocialShelf criadas via deliberação ARGUS. Todos os documentos neste escopo foram produzidos por deliberação coletiva das seeds, estruturados por SCRIBE, validados por HERALD e arquivados após validação humana.

Este escopo fica neste workspace apenas e nunca é distribuído para outros contextos. Decisões aqui substituem todos os outros escopos.

## Conteúdo

### ADRs — Decisões Arquiteturais (41 documentos)

Cobertura: princípios de engenharia, arquitetura hexagonal, monorepo, decomposição de serviços, Zero Trust, minimização de dados, identidade pairwise, retenção de dados, integração OAuth, infraestrutura GCP, geração multiartefato, transparência em incidentes, Cloud Scheduler para publicação agendada com scale-to-zero, integração TikTok (OAuth, publicação multi-etapa), geração de vídeo assíncrona com sincronização de áudio, ativação do modo automático de publicação, a espinha dorsal de campanhas de fotos e login com Google via Google Identity Services.

### EDRs — Decisões de Engenharia (43 documentos)

Cobertura: TDD obrigatória, TypeScript strict, Fastify + plugins, Next.js App Router, pipeline CI/CD, Docker multi-stage, Cloud Run, vocabulário proibido, pipeline de sinal de audiência e pauta, geração multiartefato, testes de componente em apps/web, testes visuais de regressão por viewport, tolerância a variação de formato na resposta do Gemini, pipeline de vídeo TikTok, consentimento de conteúdo de terceiros no upload, tick diário/horário de autonomia (frequência, teto por dia, histórico de tentativas), implementação e curadoria de campanhas de fotos e ordenação/visibilidade da lista de posts agendados.

### BDRs — Decisões de Negócio (10 policies + 2 planos)

Cobertura: definição de produto e público-alvo, redes sociais suportadas, limites de caracteres por plataforma, princípios de UX, design tokens, paleta do logo oficial, visão de experiência de produto, inventário do app de referência, roadmap de sprints/fases e navegação/sinalização visual no fluxo de notícias para pauta.

## Como adicionar uma policy

1. Acionar uma deliberação ARGUS sobre o tema
2. Alcançar convergência com assinaturas das seeds ativas
3. SCRIBE estrutura o documento — HERALD define o `valid-from`
4. Humano valida o rascunho
5. Policy salva no path canônico abaixo

## Índices por Tipo

- [ADRs Index](adrs/index.md) - Decisões arquiteturais e técnicas
- [BDRs Index](bdrs/index.md) - Decisões de negócio, produto e UX
- [EDRs Index](edrs/index.md) - Decisões de engenharia e fluxo de trabalho
