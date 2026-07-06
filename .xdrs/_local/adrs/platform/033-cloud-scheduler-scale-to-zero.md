---
name: _local-adr-policy-033-cloud-scheduler-wake-up-do-publisher
description: Define o mecanismo de wake-up do publisher-service via Cloud Scheduler para garantir publicação agendada mesmo com min-instances=0. Use ao ajustar o intervalo de tick, autenticação do scheduler ou lógica de verificação de posts agendados.
apply-to: .github/workflows/deploy.yml — step "Create/update Cloud Scheduler job"; apps/publisher/src/routes/scheduler.routes.ts; apps/publisher/src/scheduler/ScheduledPostsPoller.ts
valid-from: 2026-07-01
---

# _local-adr-policy-033: Cloud Scheduler — Wake-up do Publisher

## Context and Problem Statement

Todos os serviços do SocialShelf rodam com `--min-instances=0` no Cloud Run (ADR-022). Isso significa que o `publisher-service` desliga completamente em períodos de inatividade.

O mecanismo original de verificação de posts agendados era um `setInterval` em memória dentro do processo Node.js. Com `min-instances=0`, esse timer só existe enquanto a instância está de pé por outro motivo (ex: uma requisição HTTP recente). Em horários de baixíssimo uso (madrugada, feriados), o servidor dorme e posts agendados simplesmente não são publicados.

**Exemplo real:** post agendado para 12:00 no Instagram não foi publicado às 12:50 porque o servidor estava dormido e ninguém o acordou.

## Decision Outcome

**Cloud Scheduler acorda o publisher-service via HTTP a cada minuto**

### Mecanismo

1. **Cloud Scheduler job** (`publisher-scheduled-tick`): cron `* * * * *`, HTTP POST para `/internal/scheduler-tick` no `publisher-service`, autenticado via OIDC + `X-Internal-Secret` header.

2. **Endpoint `/internal/scheduler-tick`**: valida o `X-Internal-Secret`, executa `PublishScheduledPostsUseCase` (verifica Firestore por posts com `status=scheduled` e `scheduledAt <= now()`), retorna `{ ok: true }`.

3. **OIDC**: o Cloud Scheduler usa a service account `publisher-service@...` para obter um token OIDC e incluí-lo no header `Authorization: Bearer`. O Cloud Run valida esse token antes de rotear a requisição.

4. **Fallback em memória**: o `ScheduledPostsPoller` (setInterval) permanece no código como camada de redundância quando a instância já está ativa por outro motivo. Não é o mecanismo primário.

### Autenticação do endpoint

- Header `X-Internal-Secret` obrigatório (validado contra `process.env.INTERNAL_SECRET`)
- Retorna 401 se ausente ou incorreto
- O secret é gerenciado via GCP Secret Manager e injetado como variável de ambiente no Cloud Run

### IAM necessário

A service account `github-deploy@...` precisa dos papéis:
- `roles/cloudscheduler.admin` — criar/atualizar o job
- `roles/serviceusage.serviceUsageAdmin` — habilitar a API `cloudscheduler.googleapis.com`

Esses papéis **não podem ser auto-concedidos via CI** (o deployer SA não detém `resourcemanager.projects.setIamPolicy` para esses roles — mesmo padrão do signBlob do generator-service, documentado em ADR-023). Devem ser concedidos manualmente uma vez por um humano com acesso Owner/IAM Admin no GCP Console.

### Resiliência no pipeline de deploy

O step de criação do Cloud Scheduler job usa `continue-on-error: true` no `.github/workflows/deploy.yml`. Isso garante que uma falha de permissão nesse step (durante a janela antes da concessão manual) não cascateia e não bloqueia o deploy do `api-service` (que tem `needs: [deploy-publisher]`).

## Consequências

- Posts agendados publicam no horário certo mesmo após longos períodos de inatividade
- Custo adicional: zero (Cloud Scheduler é gratuito para até 3 jobs; requisições HTTP ao Cloud Run acordam a instância normalmente)
- Cold start do publisher-service (~1-2s) é absorvido dentro do timeout do Cloud Scheduler (padrão: 3 minutos)
- Se o Cloud Scheduler falhar por qualquer motivo em um minuto específico, o próximo tick (1 minuto depois) cobre — posts com atraso máximo de ~1 minuto

## References

- [_local-adr-policy-022-cloud-run-configuracao-por-servico](022-cloud-run-config.md) - min-instances=0 que motivou esta decisão
- [_local-adr-policy-023-iam-papeis-por-servico](023-iam-policies.md) - IAM roles e limitações do deployer SA
- [_local-adr-policy-005-zero-trust-baseline](../controls/005-zero-trust-baseline.md) - Base para autenticação do endpoint interno
