---
name: _local-adr-policy-008-retencao-e-privacidade-de-dados
description: Define a política de retenção e privacidade de dados do SocialShelf. Use ao implementar deleção de dados, configurar retenção de logs ou avaliar quanto tempo um dado deve ser mantido.
apply-to: Todo dado armazenado ou processado pelo sistema
valid-from: 2026-06-06
---

# _local-adr-policy-008: Retenção e Privacidade de Dados

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
| Imagens geradas | Cloud Storage `socialshelf-generated` | Post publicado: 7 dias após `publishedAt`. Foto de campanha cancelada nunca usada num post real: 7 dias após o cancelamento | Deleção automática via tick diário (`api-service`, `/internal/storage-cleanup-tick`, Cloud Scheduler); documento Firestore permanece como histórico, só o blob é apagado |
| Uploads do usuário | Cloud Storage `socialshelf-uploads` | 7 dias após publicação | Deleção automática monitorada (job agendado, alerta em falha de execução); usuário pode baixar o arquivo durante os 7 dias |
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

**Atualização 2026-07-06 — retenção de vídeo enviado pelo usuário**

A linha "Uploads do usuário" estava em aberto desde a criação desta policy. Definida no contexto da integração TikTok: vídeo enviado pelo próprio usuário (`videoSource: 'user-upload'`, ver ADR-036) pode conter conteúdo de terceiros — a retenção de 7 dias com opção de download equilibra a necessidade operacional de reenvio/correção com a minimização de passivo de dados de terceiros. A exclusão ao final do prazo é etapa monitorada, não assumida (ver EDR-034).

**Atualização 2026-07-25 — retenção de imagens geradas**

A linha "Imagens geradas" estava em aberto desde a criação desta policy: o bucket crescia sem limite, sem deleção automática de nenhuma imagem de post publicado nem de foto de campanha cancelada. Definida a mesma janela de 7 dias já em uso para vídeo (`_local-edr-policy-034`) e para uploads do usuário, por dois relógios independentes — um a partir da publicação, outro a partir do cancelamento da campanha — nunca apagando um blob ainda referenciado por um Post real. Diferente do vídeo do usuário, não há opção de download antes da exclusão: imagem gerada ou de campanha é conteúdo do próprio SocialShelf, não upload de conteúdo de terceiro. O prazo é comunicado proativamente na tela de posts publicados e nos diálogos de cancelamento de campanha, não só depois do fato (ver EDR-067).

## References

- [_local-adr-policy-002-data-minimization](../controls/006-data-minimization.md) - Critério de coleta
- [_local-adr-policy-001-incident-transparency](../operations/011-incident-transparency.md) - Protocolo de incidente
- [_local-adr-policy-036-geracao-de-video-assincrona](../application/036-geracao-video-multiartefato-assincrona.md) - Origem do upload de vídeo do usuário
- [_local-edr-policy-034-consentimento-conteudo-terceiros-upload-video](../../edrs/application/034-consentimento-conteudo-terceiros-upload.md) - Consentimento e mecanismo de exclusão monitorada
- [_local-edr-policy-067-retencao-e-limpeza-automatica-de-imagens](../../edrs/application/067-retencao-e-limpeza-automatica-de-imagens.md) - Implementação da limpeza automática de imagens geradas (posts publicados e fotos de campanha cancelada)
