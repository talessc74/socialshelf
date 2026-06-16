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
