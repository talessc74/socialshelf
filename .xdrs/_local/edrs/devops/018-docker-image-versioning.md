---
name: _local-edr-policy-018-versionamento-de-imagem-docker
description: Define a estratégia de tagging de imagens Docker no pipeline CI/CD. Use ao configurar build e push de imagens ou ao rastrear versões em produção.
apply-to: .github/workflows/deploy.yml — etapas de docker build e push
valid-from: 2026-06-16
---

# _local-edr-policy-018: Versionamento de Imagem Docker

## Context and Problem Statement

Imagens Docker sem tag versionada dificultam rollback e rastreabilidade. Usar apenas `latest` sobrescreve a imagem anterior — impossibilitando identificar qual versão está em produção ou reverter para um build anterior sem recriar a imagem.

Como tagear imagens Docker para que cada build seja rastreável e rollbacks sejam possíveis?

## Decision Outcome

**Duas tags por build: SHA do commit (`$COMMIT_SHA`) e `latest`**

### Details

**Tags aplicadas em cada build**

```bash
IMAGE="gcr.io/socialshelf-547da/${SERVICE}:${COMMIT_SHA}"
IMAGE_LATEST="gcr.io/socialshelf-547da/${SERVICE}:latest"

docker build -t "$IMAGE" -t "$IMAGE_LATEST" .
docker push "$IMAGE"
docker push "$IMAGE_LATEST"
```

**Por que SHA**

O `COMMIT_SHA` (SHA completo do commit GitHub Actions) é imutável e rastreável — permite identificar exatamente qual código está em produção e fazer rollback para qualquer commit anterior sem recriar a imagem.

**Por que `latest`**

`latest` é conveniente para deploy inicial e ambientes de desenvolvimento — aponta sempre para o build mais recente. Nunca deve ser usado como referência de produção estável.

**Deploy usa SHA**

O Cloud Run deploy referencia a imagem por SHA, não por `latest`:

```bash
gcloud run deploy api-service \
  --image="gcr.io/socialshelf-547da/api-service:${GITHUB_SHA}"
```

Isso garante que o Cloud Run sabe exatamente qual imagem está rodando e que uma push acidental de `latest` não afeta o serviço em produção.

**Limpeza de imagens antigas**

O Artifact Registry do GCP aplica política de retenção. Imagens com SHA de mais de 30 dias são candidatas a limpeza — não há necessidade de gerenciamento manual em escala atual.

## References

- [_local-edr-policy-006-docker-multi-stage-non-root](006-docker-multistage.md) - Conteúdo da imagem gerada e tagiada aqui
- [_local-edr-policy-005-ci-pipeline](005-ci-pipeline.md) - Etapa de docker build no pipeline
