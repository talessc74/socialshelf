# _local EDRs Index

Decisões de engenharia — ferramentas, práticas de implementação e fluxos de trabalho do SocialShelf.

## Subjects

### principles
Princípios de engenharia aplicados na prática.

- [_local-edr-policy-001-tdd-obrigatoria](principles/001-tdd.md) - TDD obrigatória: ciclo Red-Green-Refactor e testabilidade nativa como requisito de design
- [_local-edr-policy-002-typescript-strict-mode](principles/002-typescript-strict.md) - Flags TypeScript obrigatórias: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`

### application
Padrões de implementação de código nas aplicações.

- [_local-edr-policy-003-fastify-plugins-padrao](application/003-fastify-plugins.md) - Fastify como framework HTTP + plugins obrigatórios de segurança (cors, helmet, rate-limit, cookie)
- [_local-edr-policy-004-next-js-14-app-router](application/004-nextjs-app-router.md) - Next.js 14 com App Router exclusivo: estrutura de páginas, stack de UI e convenções de rota
- [_local-edr-policy-009-rate-limiting-global-api](application/009-rate-limiting.md) - 100 requisições por minuto por IP via @fastify/rate-limit registrado globalmente
- [_local-edr-policy-010-formato-de-resposta-da-api](application/010-api-response-format.md) - Envelope canônico de resposta: recurso para sucesso, error+details para falha
- [_local-edr-policy-011-cors-restrito-a-web-url](application/011-cors-policy.md) - CORS restrito à WEB_URL com credentials:true — sem wildcard origin
- [_local-edr-policy-012-zod-safeparse-validacao-de-input](application/012-zod-validation.md) - safeParse() em todo input externo; 400 com flatten() em falha de validação
- [_local-edr-policy-013-firebase-id-token-como-bearer](application/013-firebase-auth-bearer.md) - Firebase ID Token obtido em tempo de requisição e enviado como Authorization: Bearer
- [_local-edr-policy-014-authcontext-react](application/014-auth-context.md) - AuthContext com onAuthStateChanged como único listener de estado de autenticação
- [_local-edr-policy-015-next-js-force-dynamic-rendering](application/015-nextjs-force-dynamic.md) - force-dynamic no root layout: desabilita cache estático para toda a aplicação
- [_local-edr-policy-016-vitest-e-cobertura-v8](application/016-vitest-coverage.md) - Vitest com V8 como stack de testes unitários em todos os pacotes do monorepo
- [_local-edr-policy-017-fastify-logger-com-log-level](application/017-fastify-logger.md) - Logger nativo do Fastify com nível configurável via LOG_LEVEL
- [_local-edr-policy-020-helmet-security-headers](application/020-helmet-security-headers.md) - @fastify/helmet registrado globalmente: headers de segurança HTTP em todos os serviços
- [_local-edr-policy-021-health-check-padrao](application/021-health-check.md) - GET /health em todos os serviços: status + service + timestamp em ISO 8601
- [_local-edr-policy-022-snapshot-imutavel-de-brandprofile-por-post](application/022-snapshot-imutavel-brand-profile-post.md) - Post referencia apenas o número de versão do BrandProfile vigente na criação, nunca uma cópia
- [_local-edr-policy-023-pipeline-sinal-audiencia-sem-retencao](application/023-pipeline-sinal-audiencia.md) - Métricas brutas por post são lidas, agregadas em memória e descartadas; só o AudienceSignal final é persistido
- [_local-edr-policy-024-pipeline-de-pauta-verificacao-e-sugestao](application/024-pipeline-pauta-verificacao-sugestao.md) - Notícia é filtrada por domínio de fonte confiável antes de alimentar o motor de sugestão; sinal de audiência entra como multiplicador de score
- [_local-edr-policy-029-geracao-multiartefato-sem-bifurcacao](application/029-pipeline-geracao-multiartefato.md) - Único loop sobre artifactCount sem bifurcação de lógica; falha de copy é fatal, falha de artefato individual é tolerada
- [_local-edr-policy-030-testes-de-componente-em-apps-web](application/030-testes-componente-web.md) - Vitest + Testing Library com ambiente jsdom em apps/web; mocking de next/navigation e do cliente api; cleanup manual entre testes
- [_local-edr-policy-031-testes-visuais-de-regressao-em-apps-web](application/031-testes-visuais-regressao.md) - Playwright Component Testing em Chromium real, 3 viewports alinhados aos breakpoints Tailwind (sm/lg) já usados, com asserção geométrica de overflow + screenshot baseline gerada por job manual
- [_local-edr-policy-032-tolerancia-formato-resposta-llm](application/032-tolerancia-formato-resposta-llm.md) - Campos de lista na resposta do Gemini que ocasionalmente chegam como string única são normalizados via z.preprocess antes da validação zod, em vez de rejeitar a resposta inteira
- [_local-edr-policy-033-pipeline-video-tiktok-implementacao](application/033-tiktok-video-pipeline-implementacao.md) - Worker de vídeo via Cloud Tasks, progresso por videoStage, TikTokPublisher testado contra mock, nunca API real
- [_local-edr-policy-034-consentimento-de-terceiros-no-upload](application/034-consentimento-conteudo-terceiros-upload.md) - Checkbox de consentimento obrigatório antes do upload de vídeo próprio do usuário; detalhamento jurídico nos Termos de Uso
- [_local-edr-policy-035-upload-de-video-para-tiktok-mvp-sincrono](application/035-upload-video-tiktok-mvp-sincrono.md) - Primeira fatia real: upload próprio síncrono, sem fila/ffmpeg/áudio; proxy via radiokactus.com para satisfazer verificação de domínio do pull_by_url do TikTok
- [_local-edr-policy-036-slideshow-animado-experimental](application/036-slideshow-video-experimental.md) - Ação avulsa e opt-in que compõe slideshow animado via ffmpeg a partir de imagens já geradas, com narração por IA opcional (Google Text-to-Speech), síncrona (diverge deliberadamente do modelo de fila da ADR-036) — validação mínima antes de investir na fila completa; vídeo composto agora persiste em outputs.composedVideo e tem botão de download
- [_local-edr-policy-037-publicar-em-mais-redes-apos-o-video](application/037-publicar-em-outras-redes-apos-video.md) - Seção "Publicar também em" deixa de depender só de publishResult e passa a aparecer também depois de publicar o vídeo do TikTok; cada rodada continua criando um Post novo, nunca estendendo o original
- [_local-edr-policy-038-tick-diario-de-autonomia-implementacao](application/038-tick-autonomia-implementacao.md) - Tick diário em publisher-service (não generator-service, para não criar dependência circular de deploy); 3 novas portas de domínio; discovery de marca via collectionGroup; contador diário atômico por transação Firestore; nova seção "Aguardando sua aprovação" em /dashboard/scheduled lista os rascunhos ai-draft do modo semi-automático, filtrados por origin para não misturar com rascunhos órfãos de geração manual
- [_local-edr-policy-039-campanha-de-fotos-implementacao-fase-1](application/039-campanha-de-fotos-implementacao.md) - EXIF/GPS extraído no api-service sem porta de domínio; clustering guloso por distância haversine (raio 150m); carrossel limitado ao menor teto entre as redes selecionadas; ativação idempotente por item
- [_local-edr-policy-040-performance-sem-fetch-duplicado](application/040-performance-insights-sem-fetch-duplicado.md) - POST /performance-insights recebe as entradas já buscadas pela tela em vez de rebuscar no publisher, eliminando uma segunda rodada de chamadas ao vivo para Meta/X/LinkedIn a cada carregamento da tela de Performance
- [_local-edr-policy-041-melhor-janela-com-dado-real-de-horario](application/041-melhor-janela-com-dado-real-de-horario.md) - PostPerformanceSummary ganha publishedAt e o prompt do diagnóstico recebe o horário real (Brasília) de cada post, em vez de "Melhor janela" ser um chute do modelo sem nenhum dado de horário
- [_local-edr-policy-042-campanha-revisao-pos-saga-do-indice](application/042-campanha-revisao-pos-saga-do-indice.md) - Auditoria de todo o código de campanhas achou mais 2 queries de campo único com o mesmo bug de índice, 2 telas com o mesmo bug de erro engolido, e um N+1 de requisição por miniatura que esgotava sozinho o rate limit global — corrigido com endpoint de signed URL em lote
- [_local-edr-policy-043-campanha-curadoria-de-fotos-e-posts](application/043-campanha-curadoria-de-fotos-e-posts.md) - CampaignPhoto.order (nullable, sem migração); reordenar/apagar foto na tela de upload; linha do tempo trata a campanha como uma sequência única de fotos onde mover além da borda do post "derrama" pro post vizinho, cobrindo reordenar-no-carrossel e mover-entre-carrosséis com os mesmos botões; photoCount na lista de campanhas
- [_local-edr-policy-044-ordenacao-da-lista-de-posts-agendados](application/044-ordenacao-da-lista-de-posts-agendados.md) - Lista de /dashboard/scheduled ordenada no cliente por scheduledAt/publishedAt (o mesmo campo exibido no card), decrescente por padrão, com toggle único para agendados+publicados

### devops
Pipeline de entrega e práticas de build.

- [_local-edr-policy-005-ci-pipeline](devops/005-ci-pipeline.md) - Pipeline CI/CD sequencial obrigatório: lint → type-check → test → build → docker → deploy
- [_local-edr-policy-006-docker-multi-stage-non-root](devops/006-docker-multistage.md) - Dockerfiles multi-stage com Alpine, dependências de produção apenas e usuário não-root
- [_local-edr-policy-018-versionamento-de-imagem-docker](devops/018-docker-image-versioning.md) - Tags SHA + latest por build: SHA para rastreabilidade, latest para conveniência
- [_local-edr-policy-019-iam-bootstrap-idempotente](devops/019-iam-bootstrap.md) - Criação idempotente de service accounts e bindings IAM + 60s de espera antes do deploy

### infra
Implementação de infraestrutura e runtime.

- [_local-edr-policy-007-cloud-run-deployment](infra/007-cloud-run.md) - Configuração de deploy no Cloud Run: recursos, IAM, acesso e variáveis por serviço

### governance
Controles de governança de engenharia.

- [_local-edr-policy-008-vocabulario-proibido](governance/008-vocabulario-proibido.md) - Termos proibidos em todos os artefatos do projeto e razão de cada proibição
