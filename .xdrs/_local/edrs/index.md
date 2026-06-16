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

### devops
Pipeline de entrega e práticas de build.

- [_local-edr-policy-005-ci-pipeline](devops/005-ci-pipeline.md) - Pipeline CI/CD sequencial obrigatório: lint → type-check → test → build → docker → deploy
- [_local-edr-policy-006-docker-multi-stage-non-root](devops/006-docker-multistage.md) - Dockerfiles multi-stage com Alpine, dependências de produção apenas e usuário não-root

### infra
Implementação de infraestrutura e runtime.

- [_local-edr-policy-007-cloud-run-deployment](infra/007-cloud-run.md) - Configuração de deploy no Cloud Run: recursos, IAM, acesso e variáveis por serviço

### governance
Controles de governança de engenharia.

- [_local-edr-policy-008-vocabulario-proibido](governance/008-vocabulario-proibido.md) - Termos proibidos em todos os artefatos do projeto e razão de cada proibição
