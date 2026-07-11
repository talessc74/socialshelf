---
name: _local-bdr-policy-011-workspace-consentimento-e-quotas
description: Define modelo de workspace, consentimento para acesso compartilhado e sistema de quotas por plano. Use ao onboard novos usuários, gerenciar membros, ou calcular limites de uso.
apply-to: Produto, onboarding, billing, gestão de equipes
valid-from: 2026-07-11
---

# _local-bdr-policy-011: Workspace, Consentimento e Quotas

## Context and Problem Statement

SocialShelf transiciona para SaaS multi-tenant. Múltiplos usuários pagam mensalidade para usar o sistema. Precisamos definir:
1. O que é um "workspace"?
2. Como usuários compartilham um workspace?
3. Que limites cada plano tem?
4. Como consentimento funciona?

## Decision Outcome

**Workspace como unidade de faturamento + RBAC com 3 roles + quotas por plano + consentimento explícito para convites**

### Details

#### 1. Definição de Workspace

Um workspace é:
- Uma **célula isolada** de dados (brands, posts, membros)
- Uma **unidade de faturamento** (assinatura vinculada ao workspace)
- Uma **equipe colaborativa** (pode ter múltiplos usuários com roles diferentes)

**Exemplo:**
```
Workspace "Acme Corp" (Owner: alice@acme.com)
├─ Brand: Acme Marketing
├─ Brand: Acme Sales
└─ Members:
   ├─ alice@acme.com (Owner)
   ├─ bob@acme.com (Editor)
   └─ carol@acme.com (Viewer)
```

#### 2. Modelo de Roles (RBAC)

| Role | Permissões | Quando usar |
|---|---|---|
| **Owner** | Criar brands, criar/editar/deletar posts, convidar/remover membros, mudar plano, deletar workspace | Proprietário da conta |
| **Editor** | Criar brands, criar/editar/deletar posts, ver membros | Colaborador ativo |
| **Viewer** | Ver brands e posts (somente leitura) | Stakeholder que precisa acompanhar, mas não edita |

**Casos especiais:**
- Um workspace sempre tem pelo menos 1 Owner
- Owner não pode ser removido (se sair, delega para outro Owner antes)
- Viewer não pode criar posts (read-only, ideal para clientes/executives)

#### 3. Planos e Quotas

**Plano Free:**
- 1 workspace permitido
- 5 posts por mês
- 1 membro apenas (owner)
- Sem acesso a colaboradores
- Sem suporte prioritário

**Plano Pro:**
- 3 workspaces permitidos
- 100 posts por mês
- 5 membros por workspace
- RBAC completo (Owner, Editor, Viewer)
- Suporte por email

**Plano Enterprise:**
- Workspaces ilimitados
- Posts ilimitados
- Membros ilimitados
- RBAC customizado
- Suporte prioritário + account manager
- Compliance dedicado (retenção de logs customizável)

**Quotas rastreadas:**
```typescript
{
  plan: "free" | "pro" | "enterprise"
  quota: {
    workspaces_allowed: number
    posts_per_month: number
    team_members_per_workspace: number
  }
  usage: {
    workspaces_created: number
    posts_this_month: number
    team_members_active: number
  }
  reset_at: timestamp  ← quando reseta monthly quota
}
```

#### 4. Fluxo de Convite e Consentimento

**Princípio:** Consentimento EXPLÍCITO, não implícito.

**Fluxo:**
1. Owner → "Convidar membro" → email do novo membro
2. Sistema envia email: `[Workspace Name] invitation from [Owner Name]`
3. Email contém: "Você foi convidado para o workspace Acme Corp como Editor. Clique para aceitar ou rejeitar."
4. Novo membro → clica link → decodifica token → tela de aceitação
5. Tela mostra: "Workspace: Acme Corp | Role: Editor | Brands: [lista] | Membros: [lista]"
6. Novo membro → "Aceitar" OU "Rejeitar"
7. Se aceitar: adicionado a `/workspaces/{workspaceId}/members/{uid}` com status `active`
8. Se rejeitar: convite descartado

**O que é rastreado:**
- Quem convidou? (Owner uid)
- Quando? (timestamp)
- Que email foi enviado? (para auditoria)
- Aceitou ou rejeitou? (status final)

**Consentimento em dados compartilhados:**
Quando um Editor cria um post, o post tem metadados:
```typescript
{
  id: string
  content: string
  created_by: string  ← uid de quem criou
  created_at: timestamp
  last_modified_by: string  ← uid de quem editou por último
  last_modified_at: timestamp
  approved_by?: string  ← uid de quem aprovou (opcional, para fluxos de review)
}
```

Isso garante rastreabilidade de quem fez o quê — essencial para compliance.

#### 5. Conversão de Single-User para Multi-User

**Seu case (usuário atual):**

Hoje você usa SocialShelf como single-user. Você tem posts, brands, etc.

**Na transição:**
1. Sistema cria workspace "Personal" para você automaticamente
2. Seus dados são movidos para `/workspaces/{personal-workspace-id}`
3. Você é Owner do seu workspace
4. Você escolhe seu plano (Free, Pro, Enterprise)
5. Se quiser convidar alguém, paga Pro (se estiver em Free)

**Timeline:**
- Semana 1-2: Estrutura de workspace implementada (você pode continuar usando como single-user)
- Semana 3: UI de convite ready
- Semana 4: Você testa convidar alguém (staging/dev)
- Semana 5+: Go-live para todos os usuários

#### 6. Billing e Pagamento (MVP)

**MVP (agora):** Sem Stripe integrado. Estrutura pronta, pagamento manual/placeholder.

```typescript
workspace.settings = {
  plan: "pro"
  billing_period: "monthly"
  billing_cycle_day: 11  ← renova dia 11
  monthly_cost: 9.99
  status: "active" | "past_due" | "cancelled"
}
```

**Integração Stripe (Fase 2, depois):**
- Webhook de webhook de pagamento aceito/rejeitado
- Downgrade automático se pagamento falhar
- Invoice em email

#### 7. Onboarding de Novo Usuário

**Fluxo:**
1. Sign up → email + senha
2. "Criar workspace pessoal"
3. Nome do workspace (default: "Personal" ou "[Seu Nome]'s Workspace")
4. Pronto! Entrar no workspace
5. Plano default: Free
6. Sugestão: "Quer convidar um colaborador? Upgrade para Pro"

## Rationale

**SOVEREIGN (Identidade):** Consentimento explícito é requisito. Cada convite é rastreado, cada aceitação é rastreada.

**COMPASS (HCD):** Onboarding claro. Roles e permissões são visíveis e compreensíveis.

**EMPIRICUS (Usabilidade):** Quotas são claras ("Você tem 95 posts restantes este mês").

**BAU (Compliance):** Audit trail de consentimento, convites, e ações de usuários.

## Consequências

**Positivas:**
- Modelo de negócio claro (planos + quotas)
- Consentimento é explícito e auditável
- Escalável: adicionar usuários é self-service
- Compliance pronto (audit trail, quotas, roles)

**Negativas:**
- Onboarding é mais complexo (escolher plano, convidar)
- Gerenciamento de planos requer suporte (downgrades, cancellations)

## References

- [_local-adr-policy-042-arquitetura-multi-tenant-workspace](../../adrs/application/042-arquitetura-multi-tenant-workspace.md) - Estrutura técnica de workspace
- [_local-adr-policy-007-pairwise-identity-consent](../../adrs/controls/007-pairwise-identity-consent.md) - Consentimento como princípio de segurança
- [_local-bdr-policy-002-plataforma-produto](./002-plataforma-produto.md) - Visão geral do SocialShelf
