---
name: _local-adr-policy-010-gcp-infrastructure-baseline
description: Define GCP como plataforma de infraestrutura do SocialShelf e os serviços utilizados. Use ao provisionar novos recursos, definir permissões IAM ou avaliar novos serviços de plataforma.
apply-to: Toda infraestrutura de produção e staging
valid-from: 2026-06-06
---

# _local-adr-policy-010: GCP Infrastructure Baseline

## Context and Problem Statement

O SocialShelf precisa de infraestrutura que suporte múltiplos serviços containerizados, banco de dados em tempo real, geração de conteúdo via IA, armazenamento de segredos e entrega da interface web — com custo operacional viável para um SaaS inicial.

Quais serviços de plataforma compõem a infraestrutura do SocialShelf?

## Decision Outcome

**GCP como plataforma única com Cloud Run, Firestore, Vertex AI, Secret Manager, Cloud Storage e Artifact Registry**

Firebase é tratado como detalhe de infraestrutura — a lógica de negócio não depende diretamente de nenhum SDK Firebase. Cloud Run provê isolamento de workload por serviço.

### Details

**Serviços ativos**

| Serviço GCP | Uso no SocialShelf |
|---|---|
| Cloud Run | Runtime dos 4 serviços (api, publisher, generator, web) |
| Firestore | Banco de dados principal (users, brands, posts, oauth_connections) |
| Firebase Auth | Autenticação de usuários |
| Secret Manager | Armazenamento de tokens OAuth e credenciais |
| Vertex AI (Gemini) | Geração de cópia para posts |
| Vertex AI (Imagen) | Geração de imagens para posts |
| Cloud Storage | Uploads do usuário (`socialshelf-uploads`) e imagens geradas (`socialshelf-generated`) |
| Artifact Registry | Repositório de imagens Docker |
| Cloud Tasks / Scheduler | Agendamento de posts (sprint 3) |
| Cloud Logging | Logs de aplicação |

**IAM — Princípio de menor privilégio**

| Service Account | Roles |
|---|---|
| `api-service` | `roles/datastore.user`, `roles/secretmanager.admin` |
| `publisher-service` | `roles/datastore.user`, `roles/secretmanager.admin` |
| `generator-service` | `roles/datastore.user`, `roles/aiplatform.user`, `roles/storage.objectAdmin`, `roles/iam.serviceAccountTokenCreator` |

- Bootstrap IAM é idempotente e executado antes de cada deploy (ver `deploy.yml`).
- Propagação IAM requer espera de 60s após criação/atualização de roles.

**Firebase como detalhe de infraestrutura**

- O `packages/domain` não importa nenhum SDK Firebase.
- `FirestoreOAuthRepository`, `FirestorePostRepository` e `FirestoreTokenVault` são adapters — substituíveis sem alterar use-cases.
- Deploy não é considerado entregue sem validação de impacto de segurança.

**Configuração de projeto**

- GCP Project: `socialshelf-547da`
- Região primária: `us-central1`
- Modelos Vertex AI: `gemini-2.5-flash` (copy), `imagen-4.0-generate-001` (imagens)
- Localização Vertex AI: `us-central1` para Imagen (endpoint regional, `${location}-aiplatform.googleapis.com`); `global` para Gemini (`GEMINI_LOCATION`), conforme exigido pelos endpoints atuais do modelo

**Drift de política/realidade — depreciação de modelo (2026-06-20)**

`gemini-2.0-flash`, registrado originalmente nesta ADR, foi descontinuado e removido do Model Garden do projeto. O endpoint atual do Gemini para geração de texto também passou a exigir `location=global` em vez de uma região — diferente do Imagen, que continua exigindo região real (`us-central1`) por construir a URL do endpoint manualmente (`${location}-aiplatform.googleapis.com`). Por isso `generator-service` agora usa duas variáveis de localização: `VERTEX_AI_LOCATION=us-central1` (Imagen) e `GEMINI_LOCATION=global` (Gemini). Esta não é uma decisão arquitetural nova — é a atualização desta ADR para refletir a realidade do Model Garden após a depreciação do modelo anterior.

Pelo mesmo motivo, `imagegeneration@006` (Imagen 2) também atingiu fim de vida (`404 NOT_FOUND`, confirmado em produção em 2026-06-20) e foi substituído por `imagen-4.0-generate-001` (Imagen 4), confirmado disponível no Model Garden do projeto.

**Detalhe de implementação — `apiEndpoint` explícito para location `global`**

O SDK `@google-cloud/vertexai` (v1.x) monta o host da requisição como `${location}-aiplatform.googleapis.com` independente do valor de `location`. Com `location: 'global'` isso produz o host inválido `global-aiplatform.googleapis.com`, que retorna uma página de erro HTML em vez de JSON (causando `Unexpected token '<' ... is not valid JSON` na camada de geração de copy/análise). Correção: `GeminiCopyGenerator` e `GeminiPatternAnalyzer` agora passam `apiEndpoint: 'aiplatform.googleapis.com'` explicitamente ao `VertexAI` quando `location === 'global'`, contornando a montagem padrão do SDK.

**Drift de provisionamento — bucket `socialshelf-generated` ausente (2026-06-20)**

O bucket `socialshelf-generated`, referenciado em `GCS_BUCKET_GENERATED` desde a primeira versão desta ADR, nunca foi criado em produção (`404 The specified bucket does not exist`, confirmado ao testar a geração de imagem). `bootstrap-iam` no `deploy.yml` agora concede `roles/storage.objectAdmin` e `roles/iam.serviceAccountTokenCreator` (necessário para `getSignedUrl` sem arquivo de chave) à SA `generator-service`, mas a criação do bucket em si — assim como `roles/datastore.owner` do deployer SA — é uma ação que exige permissão de provisionamento de recursos (`storage.buckets.create`) que o deployer SA não detém (Zero Trust, `_local-adr-policy-005`), e por isso deve ser feita manualmente uma vez por alguém com acesso de Owner/Storage Admin.

**Correção — `iam.serviceAccountTokenCreator` precisa de binding no recurso da SA, não no projeto (2026-06-20)**

Mesmo após o bucket ser criado e o binding de `roles/iam.serviceAccountTokenCreator` no projeto (acima) propagar, `getSignedUrl()` continuou falhando em produção com `Permission 'iam.serviceAccounts.signBlob' denied on resource`. Causa: para um SA assinar blobs para si mesmo (auto-impersonation, exigido por `getSignedUrl()` sem arquivo de chave), o Google exige que o binding de `roles/iam.serviceAccountTokenCreator` seja feito no recurso da própria service account (`gcloud iam service-accounts add-iam-policy-binding`), não apenas no projeto — binding de projeto não habilita essa permissão para auto-assinatura. `bootstrap-iam` agora também executa esse binding resource-level para `generator-service`.

## References

- [_local-adr-policy-003-service-decomposition](../application/004-service-decomposition.md) - Serviços e seus limites
- [_local-edr-policy-001-cloud-run](../../edrs/infra/007-cloud-run.md) - Configuração detalhada do Cloud Run
- [_local-adr-policy-001-zero-trust-baseline](../controls/005-zero-trust-baseline.md) - IAM e micro-segmentação
