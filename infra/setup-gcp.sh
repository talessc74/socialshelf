#!/usr/bin/env bash
# setup-gcp.sh — configura o projeto GCP para o SocialShelf
# Execute uma vez com: bash infra/setup-gcp.sh
set -euo pipefail

PROJECT_ID="socialshelf-547da"
REGION="us-central1"
GITHUB_REPO="talessc74/socialshelf"

echo "==> Configurando projeto: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

# ── APIs ──────────────────────────────────────────────────────────────────────
echo "==> Habilitando APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  cloudtasks.googleapis.com \
  cloudscheduler.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com

# ── Artifact Registry ────────────────────────────────────────────────────────
echo "==> Criando repositório no Artifact Registry..."
gcloud artifacts repositories create socialshelf \
  --repository-format=docker \
  --location="$REGION" \
  --description="SocialShelf Docker images" || true

# ── Service Accounts por serviço ─────────────────────────────────────────────
echo "==> Criando Service Accounts..."
for SERVICE in api-service publisher-service generator-service; do
  gcloud iam service-accounts create "$SERVICE" \
    --display-name="SocialShelf $SERVICE" || true
done

# ── IAM — permissões por serviço ─────────────────────────────────────────────
echo "==> Configurando permissões IAM..."

# api-service: lê/escreve Firestore, acessa Secret Manager
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:api-service@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:api-service@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# publisher-service: lê Firestore, acessa Secret Manager
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:publisher-service@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:publisher-service@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# generator-service: Firestore, Storage, Vertex AI
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:generator-service@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:generator-service@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:generator-service@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# ── Workload Identity Federation (GitHub Actions → GCP sem chave) ────────────
echo "==> Configurando Workload Identity Federation..."

gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool" || true

gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Actions Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com" || true

WORKLOAD_IDENTITY_POOL_ID=$(gcloud iam workload-identity-pools describe "github-pool" \
  --location="global" \
  --format="value(name)")

# Service Account para o GitHub Actions fazer deploy
gcloud iam service-accounts create "github-deploy" \
  --display-name="GitHub Actions Deploy" || true

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:github-deploy@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:github-deploy@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:github-deploy@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud iam service-accounts add-iam-policy-binding \
  "github-deploy@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/${GITHUB_REPO}"

# ── Output dos secrets para o GitHub ─────────────────────────────────────────
echo ""
echo "==> Configuração concluída. Adicione estes valores nos GitHub Secrets:"
echo ""
echo "GCP_WORKLOAD_IDENTITY_PROVIDER:"
gcloud iam workload-identity-pools providers describe "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
echo ""
echo "GCP_SERVICE_ACCOUNT:"
echo "github-deploy@${PROJECT_ID}.iam.gserviceaccount.com"
