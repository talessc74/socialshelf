---
name: _local-adr-policy-022-cloud-run-configuracao-por-servico
description: Define a configuração de recursos e acesso para cada serviço no Cloud Run. Use ao ajustar capacidade, timeout ou política de acesso de qualquer serviço.
apply-to: .github/workflows/deploy.yml — etapas de deploy de cada serviço
valid-from: 2026-06-16
---

# _local-adr-policy-022: Cloud Run — Configuração por Serviço

## Context and Problem Statement

Cada serviço do SocialShelf tem características de carga, tempo de execução e requisito de acesso distintos. Uma configuração única para todos os serviços desperdiça recursos nos simples e subdimensiona os pesados.

Como configurar cada serviço no Cloud Run de forma proporcional à sua responsabilidade?

## Decision Outcome

**Configuração diferenciada por serviço com base no perfil de carga e sensibilidade**

### Details

**Configuração por serviço**

| Parâmetro | api-service | publisher-service | generator-service | web-service |
|---|---|---|---|---|
| Memória | 512Mi | 512Mi | 1Gi | 512Mi |
| CPU | 1 | 1 | 1 | 1 |
| Acesso | público | público | **privado** | público |
| Instâncias min | 0 | 0 | 0 | 0 |
| Instâncias max | 3 | 3 | 2 | 3 |
| Timeout | 30s | 60s | 120s | 30s |

**Justificativas**

- `generator-service` com `--no-allow-unauthenticated`: geração via Vertex AI é operação cara e sensível — nunca exposta publicamente
- `publisher-service` timeout de 60s: publicação pode envolver upload de mídia e retry em APIs externas
- `generator-service` timeout de 120s: geração de copy + imagem via Vertex AI pode levar até 60–90 segundos
- `generator-service` 1Gi: Vertex AI SDK e processamento de resposta têm footprint maior que Fastify simples
- `generator-service` max 2: custo de geração por instância é significativamente maior; limitar escalonamento
- Todas as instâncias min=0: custo zero em inatividade; cold start aceitável para o volume atual

**Comunicação interna**

`api-service` e `publisher-service` se comunicam via HTTP com `INTERNAL_SECRET` no header — não por VPC interna. O `generator-service` privado recebe chamadas apenas de serviços autenticados via Cloud Run IAM ou `INTERNAL_SECRET`.

**Alteração de configuração**

Mudanças nos parâmetros acima (especialmente `allow-unauthenticated`) requerem deliberação da Galera de Segurança antes de aplicar — impactam o modelo de ameaça documentado em ADR-005.

## References

- [_local-adr-policy-005-zero-trust-baseline](../controls/005-zero-trust-baseline.md) - Base para a decisão de acesso privado no generator
- [_local-adr-policy-023-iam-papeis-por-servico](023-iam-policies.md) - IAM roles correspondentes a cada serviço
- [_local-edr-policy-007-cloud-run-deployment](../../edrs/infra/007-cloud-run.md) - Processo de deploy no Cloud Run
