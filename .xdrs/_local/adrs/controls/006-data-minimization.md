---
name: _local-adr-policy-006-dados-como-passivo-minimizacao
description: Define dados como passivo e a minimização como princípio de coleta. Use ao projetar novas features que envolvam dados de usuário, definir campos de schema ou avaliar integrações.
apply-to: Toda coleta, armazenamento, processamento e transmissão de dados de usuário
valid-from: 2026-06-06
---

# _local-adr-policy-006: Dados como Passivo — Minimização

## Context and Problem Statement

Dados do usuário criam valor operacional mas também aumentam o raio de exposição do sistema. Em um SaaS que acessa contas de redes sociais, a quantidade de dados armazenados é diretamente proporcional ao impacto de um eventual comprometimento.

Qual é o critério para decidir se um dado deve ser coletado, retido ou transmitido?

## Decision Outcome

**Dados são passivos — coletados apenas quando a utilidade operacional supera o risco de responsabilidade**

Cada novo dado proposto deve responder explicitamente: a utilidade operacional supera o risco de responsabilidade? Se não, é rejeitado sem deliberação adicional.

### Details

**Critério de coleta**

Antes de coletar qualquer dado:
1. O dado é estritamente necessário para a operação declarada?
2. A retenção mais curta possível ainda permite a operação?
3. O dado pode ser descartado após o processamento em vez de armazenado?

Se qualquer resposta for "não" ou "talvez", o dado não deve ser coletado.

**Política por dimensão**

| Dimensão | Posição |
|---|---|
| Coleta | Mínima — apenas o estritamente necessário para a operação |
| Retenção | O menor período operacionalmente viável |
| Compartilhamento | Nunca sem consentimento explícito e propósito declarado |
| Identificadores | Pairwise por serviço; nenhum ID global permanente |
| Tokens OAuth | Armazenados criptografados via Secret Manager; escopo mínimo solicitado |
| Logs | Sem dados pessoais identificáveis; retenção limitada |
| Metadados de identidade | Criptografados ou descartados, salvo necessidade de segurança documentada |

**Tokens OAuth**
Tokens de acesso não são armazenados diretamente no Firestore. São armazenados no Google Secret Manager via `SecretManagerTokenVault`. O Firestore guarda apenas a referência (`tokenRef`) — nunca o token em texto claro.

**Não é permitido**
- Armazenar dados de usuário "por precaução" para uso futuro não definido.
- Coletar mais escopos OAuth do que o necessário para publicação.
- Manter logs com PII (emails, nomes, IDs de usuário em texto livre).

## References

- [_local-adr-policy-003-pairwise-identity-consent](007-pairwise-identity-consent.md) - Consentimento explícito como pré-requisito
- [_local-adr-policy-001-data-retention-privacy](../data/008-data-retention-privacy.md) - Tabela de retenção detalhada
- [_local-adr-policy-001-zero-trust-baseline](005-zero-trust-baseline.md) - Escrita de dados sensíveis restrita ao backend
