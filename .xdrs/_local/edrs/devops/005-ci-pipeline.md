---
name: _local-edr-policy-005-ci-pipeline
description: Define o pipeline de CI/CD do SocialShelf via GitHub Actions. Use ao modificar workflows, adicionar etapas de validação ou entender a ordem de execução do build.
apply-to: .github/workflows/ — ci.yml e deploy.yml
valid-from: 2026-06-06
---

# _local-edr-policy-005: CI Pipeline

## Context and Problem Statement

Um pipeline de CI que não bloqueia merge com testes falhando ou sem cobertura não é um pipeline de CI — é documentação opcional. O SocialShelf precisa de um pipeline que garanta que código sem testes ou com erros de tipo nunca chegue ao deploy.

Qual é a sequência obrigatória de validação antes de um deploy?

## Decision Outcome

**Pipeline sequencial obrigatório: lint + type-check → test com coverage → build → docker → deploy**

Nenhuma etapa avança sem a anterior ter passado. Deploy só ocorre após todas as validações em CI.

### Details

**ci.yml — pipeline de validação (branches main e claude/**, PRs)**

```
1. lint-and-typecheck
   └── pnpm install --frozen-lockfile
   └── pnpm type-check      ← tsc em todos os packages
   └── pnpm lint            ← ESLint centralizado

2. test (depende de lint-and-typecheck)
   └── pnpm test:coverage   ← Vitest com coverage
   └── Upload artefato de coverage

3. build (depende de test)
   └── pnpm build           ← Turborepo build em ordem de dependência

4. docker-build-check (depende de build, matrix: api, publisher, generator)
   └── docker/build-push-action sem push ← valida Dockerfiles
```

**deploy.yml — pipeline de deploy (push em main)**

```
1. bootstrap-iam          ← cria service accounts + roles (idempotente)
   └── Aguarda 60s para propagação IAM

2. deploy-api             ← paralelo com publisher e generator
3. deploy-publisher       ← paralelo
4. deploy-generator       ← paralelo

5. deploy-web             ← após os serviços backend
```

**Regras**

- `pnpm install --frozen-lockfile` é obrigatório — sem resolução automática de versões em CI.
- Type-check roda antes dos testes — erros de tipo são bloqueantes.
- Coverage é armazenado como artefato — auditável por sprint.
- Docker build sem push em CI valida que o Dockerfile está correto antes do merge.
- Deploy em produção só ocorre após CI completo em `main`.

**O que não é permitido**

- Pular a etapa de testes com `--skip-tests` ou equivalente.
- Fazer deploy manual sem passar pelo pipeline.
- Ignorar warnings de type-check tratando-os como não-bloqueantes.

## References

- [_local-edr-policy-001-tdd](../principles/001-tdd.md) - Coverage como produto obrigatório do pipeline
- [_local-edr-policy-002-docker-multistage](006-docker-multistage.md) - Dockerfile validado em CI
- [_local-edr-policy-001-cloud-run](../infra/007-cloud-run.md) - Deploy no Cloud Run após CI
