---
name: _local-adr-policy-011-transparencia-em-incidentes
description: Define o protocolo de comunicação em incidentes de segurança do SocialShelf. Use ao identificar vulnerabilidade, comprometimento de dados ou falha de segurança com impacto em usuários.
apply-to: Todos os incidentes de segurança com potencial impacto em dados de usuário
valid-from: 2026-06-06
---

# _local-adr-policy-011: Transparência em Incidentes

## Context and Problem Statement

Em um SaaS que detém tokens OAuth de acesso a contas de redes sociais, um incidente de segurança tem impacto direto sobre a privacidade e segurança das contas dos usuários. A forma como o incidente é comunicado determina se os usuários podem tomar ações protetoras em tempo hábil.

Qual é o protocolo de comunicação quando uma vulnerabilidade ou comprometimento de dados é identificado?

## Decision Outcome

**Comunicação imediata e direta com usuários afetados — contenção de informação não é uma opção**

Transparência radical é o padrão operacional. Soluções baseadas em caixas-pretas proprietárias são preteridas em favor de protocolos verificáveis.

### Details

**Protocolo de incidente**

1. **Identificação**: Qualquer membro da equipe que identifica uma vulnerabilidade ou comprometimento deve reportar imediatamente — sem aguardar confirmação completa do escopo.
2. **Contenção**: Ações de contenção (revogação de tokens, remoção de acesso, bloqueio de endpoint) são executadas antes da comunicação pública, mas não em substituição a ela.
3. **Comunicação**: Usuários afetados são notificados de forma direta com:
   - O que aconteceu (em linguagem clara, sem jargão)
   - Quais dados foram ou podem ter sido afetados
   - O que o usuário deve fazer (ex: reconectar plataformas, trocar senhas em redes afetadas)
   - O que o SocialShelf está fazendo para remediar
4. **Remediação**: Após contenção, análise de causa raiz e remediação são documentadas.

**O que não é permitido**

- Atrasar comunicação com usuários aguardando "certeza absoluta" do escopo.
- Comunicar apenas que "houve um incidente" sem detalhar o impacto real ou potencial.
- Usar linguagem que minimize ou obscureça o impacto para o usuário.
- Depender de soluções de segurança cuja operação não pode ser auditada pela equipe.

**Fator humano**

Defesas técnicas robustas não eliminam vulnerabilidade humana. Fluxos de autenticação e suporte consideram engenharia social, pretexting e colheita de informação como vetores reais. Qualquer fluxo de "recuperação de conta" ou "suporte de acesso" deve ser tratado como superfície de ataque potencial.

## References

- [_local-adr-policy-001-zero-trust-baseline](../controls/005-zero-trust-baseline.md) - Controles que reduzem superfície de incidente
- [_local-adr-policy-001-data-retention-privacy](../data/008-data-retention-privacy.md) - O que está em risco em um incidente
