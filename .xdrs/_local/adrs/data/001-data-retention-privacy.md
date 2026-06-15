---
name: _local-adr-policy-001-data-retention-privacy
description: Define a política de retenção e privacidade de dados do SocialShelf. Use ao implementar deleção de dados, configurar retenção de logs ou avaliar quanto tempo um dado deve ser mantido.
apply-to: Todo dado armazenado ou processado pelo sistema
valid-from: 2026-06-06
---

# _local-adr-policy-001: Retenção e Privacidade de Dados

## Context and Problem Statement

A política de retenção é o principal determinante da superfície de exposição do sistema. Dados retidos além do necessário aumentam o impacto de comprometimentos sem agregar valor operacional.

Por quanto tempo cada tipo de dado deve ser retido e quais são as regras de deleção?

## Decision Outcome

**Retenção mínima operacionalmente viável por tipo de dado, com deleção ativa**

Dados são retidos apenas pelo período mínimo necessário para a operação declarada. Deleção é uma operação de rotina, não uma exceção.

### Details

| Tipo de dado | Onde armazenado | Retenção | Regra de deleção |
|---|---|---|---|
| Tokens OAuth | Secret Manager | Duração da conexão autorizada | Deletados ao revogar conexão |
| OAuthConnection | Firestore `/users/{uid}/oauth_connections` | Duração da conexão | Deletada ao revogar ou desconectar plataforma |
| Posts | Firestore `/users/{uid}/brands/{bid}/posts` | Enquanto o usuário mantiver a conta | Deletados com a conta |
| GenerationRequests | Firestore `/users/{uid}/brands/{bid}/generation_requests` | Curto prazo operacional | A definir em sprint 2b |
| Imagens geradas | Cloud Storage `socialshelf-generated` | A definir em sprint 2b | A definir em sprint 2b |
| Uploads do usuário | Cloud Storage `socialshelf-uploads` | Até publicação + margem curta | A definir em sprint 2b |
| Logs de aplicação | Cloud Logging | Mínimo operacional | Sem PII; retenção limitada pelo padrão GCP |
| Dados de sessão | Firebase Auth | Duração da sessão | Expiração por timeout de sessão |
| daily_quota | Firestore | Dia corrente | Rotação diária automática |

**Dados pessoais identificáveis (PII) em logs**

Logs de aplicação nunca devem conter:
- Email, nome ou ID de usuário em texto livre
- Tokens OAuth ou fragmentos de token
- Conteúdo de posts do usuário
- IPs de usuário em produção

**Vulnerabilidades**

Em caso de comprometimento de dados, a comunicação com os usuários afetados é imediata e direta. Detalhes de implementação em `_local-adr-policy-001-incident-transparency`.

## References

- [_local-adr-policy-002-data-minimization](../controls/002-data-minimization.md) - Critério de coleta
- [_local-adr-policy-001-incident-transparency](../operations/001-incident-transparency.md) - Protocolo de incidente
