# _local EDRs Index

Decisões de engenharia — ferramentas, práticas de implementação e fluxos de trabalho do SocialShelf.

## Subjects

### principles
Princípios de engenharia aplicados na prática.

- [_local-edr-policy-001-tdd](principles/001-tdd.md) - TDD obrigatória: ciclo Red-Green-Refactor e testabilidade nativa como requisito de design
- [_local-edr-policy-002-typescript-strict](principles/002-typescript-strict.md) - Flags TypeScript obrigatórias: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`

### application
Padrões de implementação de código nas aplicações.

- [_local-edr-policy-001-fastify-plugins](application/001-fastify-plugins.md) - Fastify como framework HTTP + plugins obrigatórios de segurança (cors, helmet, rate-limit, cookie)
- [_local-edr-policy-002-nextjs-app-router](application/002-nextjs-app-router.md) - Next.js 15 com App Router exclusivo: estrutura de páginas, stack de UI e convenções de rota

### devops
Pipeline de entrega e práticas de build.

- [_local-edr-policy-001-ci-pipeline](devops/001-ci-pipeline.md) - Pipeline CI/CD sequencial obrigatório: lint → type-check → test → build → docker → deploy
- [_local-edr-policy-002-docker-multistage](devops/002-docker-multistage.md) - Dockerfiles multi-stage com Alpine, dependências de produção apenas e usuário não-root

### infra
Implementação de infraestrutura e runtime.

- [_local-edr-policy-001-cloud-run](infra/001-cloud-run.md) - Configuração de deploy no Cloud Run: recursos, IAM, acesso e variáveis por serviço

### governance
Controles de governança de engenharia.

- [_local-edr-policy-001-vocabulario-proibido](governance/001-vocabulario-proibido.md) - Termos proibidos em todos os artefatos do projeto e razão de cada proibição
