---
name: _local-adr-policy-023-iam-papeis-por-servico
description: Define os papéis IAM atribuídos a cada service account no GCP. Use ao criar novo serviço, adicionar integração com serviço GCP ou revisar permissões existentes.
apply-to: .github/workflows/deploy.yml — etapa bootstrap-iam; GCP IAM
valid-from: 2026-06-16
---

# _local-adr-policy-023: IAM — Papéis por Serviço

## Context and Problem Statement

Cada serviço no Cloud Run opera com uma service account própria. Atribuir papéis amplos (como `Project Editor` ou `Owner`) é prática que viola o princípio do mínimo privilégio — um serviço comprometido pode escalar para o projeto inteiro.

Como garantir que cada service account tenha apenas as permissões necessárias para seu funcionamento?

## Decision Outcome

**Papéis IAM mínimos por service account, atribuídos explicitamente no bootstrap de CI/CD**

### Details

**Papéis por serviço**

| Service Account | Papel IAM | Justificativa |
|---|---|---|
| `api-service` | `roles/datastore.user` | Leitura e escrita no Firestore (tokens, posts, conexões) |
| `api-service` | `roles/secretmanager.admin` | Gerenciamento de secrets OAuth via Secret Manager (alternativa ao vault) |
| `publisher-service` | `roles/datastore.user` | Leitura de tokens no vault e atualização de status de posts |
| `publisher-service` | `roles/secretmanager.admin` | Acesso a secrets de publicação |
| `generator-service` | `roles/datastore.user` | Leitura de briefings e escrita de resultados de geração |
| `generator-service` | `roles/aiplatform.user` | Chamadas ao Vertex AI (Gemini, Imagen) |
| `deployer-SA` | `roles/iam.serviceAccountUser` | Ator do deploy — pode impersonar service accounts de serviço |
| `deployer-SA` | `roles/datastore.owner` | Necessário para deploy de Firestore rules e indexes |

**`generator-service` não tem `secretmanager.admin`**

O `generator-service` não gerencia tokens OAuth — não precisa de acesso a secrets. Separação intencional: se o serviço de geração for comprometido, não há acesso a credenciais de redes sociais.

**Bootstrap idempotente**

Service accounts são criadas no CI com fallback para "já existe" (`gcloud iam service-accounts create ... || true`). Bindings de papel são aplicados a cada deploy — são idempotentes no GCP.

**Adicionar novo papel**

Qualquer adição de papel IAM a uma service account deve:
1. Ser justificada pela necessidade mínima
2. Ser aprovada pela Galera de Segurança antes de aplicar
3. Ser refletida nesta tabela

## References

- [_local-adr-policy-005-zero-trust-baseline](../controls/005-zero-trust-baseline.md) - Princípio de mínimo privilégio como derivado do Zero Trust
- [_local-adr-policy-010-gcp-infrastructure-baseline](010-gcp-infrastructure.md) - Serviços GCP usados por cada service account
- [_local-adr-policy-022-cloud-run-configuracao-por-servico](022-cloud-run-config.md) - Serviços que essas service accounts operam
