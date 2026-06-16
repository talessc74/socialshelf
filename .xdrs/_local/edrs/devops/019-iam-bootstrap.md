---
name: _local-edr-policy-019-iam-bootstrap-idempotente
description: Define o processo de criação de service accounts e bindings IAM no CI/CD. Use ao adicionar novo serviço ou ao modificar permissões GCP.
apply-to: .github/workflows/deploy.yml — job bootstrap-iam
valid-from: 2026-06-16
---

# _local-edr-policy-019: IAM Bootstrap Idempotente

## Context and Problem Statement

Service accounts e bindings IAM precisam existir antes do deploy. Criar manualmente no GCP Console é propenso a erro e não é reproduzível. Criar no CI sem idempotência causa falhas em deploys subsequentes quando os recursos já existem.

Como garantir que a infraestrutura IAM necessária seja criada automaticamente no CI de forma segura e reproduzível?

## Decision Outcome

**Job `bootstrap-iam` idempotente no pipeline: create-or-ignore para service accounts + 60s de espera antes do deploy**

### Details

**Criação de service accounts**

```bash
gcloud iam service-accounts create api-service \
  --display-name="API Service" \
  --project=socialshelf-547da 2>/dev/null || true
```

`2>/dev/null || true` descarta erro `ALREADY_EXISTS` e continua. O GCP retorna código de saída não-zero para recursos existentes — o `|| true` garante que o job não falha nesses casos.

**Bindings de papel**

```bash
gcloud projects add-iam-policy-binding socialshelf-547da \
  --member="serviceAccount:api-service@socialshelf-547da.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

Bindings são idempotentes no GCP — reaplicar um binding existente não gera erro nem duplicata.

**60 segundos de espera antes do deploy**

```bash
echo "Aguardando propagação IAM..."
sleep 60
```

IAM no GCP propaga de forma assíncrona — um binding recém-criado pode levar até 60 segundos para ser reconhecido pelos serviços. Deploy imediato após o binding pode resultar em falha de permissão no primeiro request ao serviço novo.

Esta espera é necessária apenas quando há mudança de binding. Em deploys sem alteração IAM, o tempo é desperdiçado mas o impacto é aceitável dado o ciclo de deploy pouco frequente.

**Papéis por serviço**

Ver ADR-023 para a lista completa de papéis por service account.

## References

- [_local-adr-policy-023-iam-papeis-por-servico](../../adrs/platform/023-iam-policies.md) - Papéis IAM que este bootstrap aplica
- [_local-edr-policy-005-ci-pipeline](005-ci-pipeline.md) - Posição do bootstrap-iam no pipeline
