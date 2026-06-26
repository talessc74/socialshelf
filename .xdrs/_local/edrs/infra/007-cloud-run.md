---
name: _local-edr-policy-007-cloud-run-deployment
description: Define a configuração de deploy dos serviços no Cloud Run. Use ao modificar parâmetros de deploy, configurar variáveis de ambiente ou definir limites de recursos de um serviço.
apply-to: Todos os serviços deployados no Cloud Run
valid-from: 2026-06-06
---

# _local-edr-policy-007: Cloud Run Deployment

## Context and Problem Statement

Quatro serviços com requisitos de recursos e acesso distintos precisam de configuração de deploy consistente e com princípio de menor privilégio — sem exposição desnecessária e com IAM correto por serviço.

Como configurar o deploy no Cloud Run para cada serviço com segurança e eficiência de custo?

## Decision Outcome

**Deploy via `gcloud run deploy` com configuração explícita de IAM, recursos e acesso por serviço**

Bootstrap IAM idempotente antes de cada deploy. Serviços internos sem acesso público. Recursos dimensionados por tipo de carga.

### Details

**Configuração por serviço**

| Parâmetro | api | publisher | generator | web |
|---|---|---|---|---|
| Acesso | Público | Interno | Interno | Público |
| min-instances | 0 | 0 | 0 | 0 |
| max-instances | 3 | 3 | 2 | 3 |
| memory | 512Mi | 512Mi | 1Gi | 512Mi |
| cpu | 1 | 1 | 1 | 1 |
| timeout | 300s | 300s | 300s | 30s |

- `publisher` tem timeout maior (300s) porque publicação em APIs externas é I/O-bound.
- `generator` tem memória maior (1Gi) e timeout maior (300s) para geração de imagens via Vertex AI.
- `generator` é `--no-allow-unauthenticated` — acessível apenas pelo `api` com `INTERNAL_SECRET`.

> **Atualização 2026-06-26**: o timeout do `generator` foi reajustado de 120s → 180s (sem
> atualização deste registro na época) e agora de 180s → 300s. Causa: o pipeline de geração
> com imagem por IA (copy + direção de arte + Imagen + render) roda de forma síncrona numa
> única requisição; sob cold start, 180s era insuficiente e a conexão era cortada antes de
> qualquer resposta HTTP, manifestando como falha de rede no cliente. Sem impacto no modelo
> Zero Trust (ADR-005) — não altera autenticação, IAM ou exposição pública, apenas a janela
> de espera por resposta.

**IAM — Bootstrap antes do deploy**

Executado em `bootstrap-iam` job antes de qualquer deploy:
```yaml
gcloud iam service-accounts create api-service
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:api-service@..." \
  --role="roles/datastore.user"
# Aguardar 60s para propagação IAM
```

Roles por serviço — ver `_local-adr-policy-001-gcp-infrastructure` para tabela completa.

**Variáveis de ambiente**

Passadas como `--set-env-vars` no deploy — nunca em Dockerfile ou código. Secrets OAuth são referenciados por nome no Secret Manager, não passados como variável.

**O que não é permitido**

- Deploy de `publisher` ou `generator` com `--allow-unauthenticated`.
- Hardcode de credenciais em variáveis de ambiente do Cloud Run.
- Deploy sem ter passado por CI completo em `main`.

## References

- [_local-edr-policy-001-ci-pipeline](../devops/005-ci-pipeline.md) - CI precede deploy
- [_local-edr-policy-002-docker-multistage](../devops/006-docker-multistage.md) - Imagem construída antes do deploy
- [_local-adr-policy-001-gcp-infrastructure](../../adrs/platform/010-gcp-infrastructure.md) - IAM roles por serviço
