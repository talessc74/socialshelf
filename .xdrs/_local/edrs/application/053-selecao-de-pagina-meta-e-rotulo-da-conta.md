---
name: _local-edr-policy-053-selecao-de-pagina-meta-e-rotulo-da-conta
description: HandleMetaCallbackUseCase parava de auto-selecionar a primeira Página do Facebook/Instagram administrada pelo usuário quando há mais de uma — agora exige escolha explícita, no mesmo padrão de pending-selection já usado pelo LinkedIn Page. OAuthConnection ganha accountLabel (nome da Página/@handle) exibido na Central de Contas. Use ao mexer em HandleMetaCallbackUseCase, persistMetaPageConnection, meta.routes.ts, ou na tela /dashboard/accounts.
apply-to: apps/api — HandleMetaCallbackUseCase, persistMetaPageConnection, GetPendingMetaPageSelectionUseCase, ConfirmMetaPageSelectionUseCase, meta.routes.ts, persistLinkedInPageConnection; packages/domain — OAuthConnection; apps/web — dashboard/accounts/page.tsx, lib/api.ts
valid-from: 2026-07-17
---

# _local-edr-policy-053: Seleção de Página Meta e rótulo da conta

## Context and Problem Statement

Usuário relatou (com print da Central de Contas) que uma campanha marcada como "conta pessoal"
estava na verdade publicando no perfil profissional "EAI Jurídico" — sem ter escolhido isso em
nenhum momento do fluxo de conexão.

Investigação do código confirmou a causa: `HandleMetaCallbackUseCase.execute` chamava
`getUserPages` (que retorna todas as Páginas do Facebook administradas pelo usuário via
`/me/accounts`) e sempre persistia `pages[0]` como a conexão do Facebook, e separadamente
selecionava via `.find()` a primeira Página com `instagram_business_account` vinculado para a
conexão do Instagram — sem nenhuma pergunta ao usuário e sem sequer garantir que Facebook e
Instagram apontassem pra mesma Página. O LinkedIn já resolve exatamente essa ambiguidade com um
seletor explícito (`HandleLinkedInPageCallbackUseCase` → pending-selection → `/dashboard/accounts`
→ escolha manual); o Meta nunca teve o equivalente.

Agravante: a Central de Contas mostrava apenas um badge genérico "● Conectado" para cada
plataforma, sem nome ou @handle da Página/conta de fato vinculada — não havia como o usuário
verificar, depois de conectado, qual conta específica estava ativa sem sair do produto e checar
no Meta Business Suite.

Limitação estrutural que este fix não muda: publicar no Instagram exige uma conta
Business/Creator vinculada a uma Página do Facebook — não é possível conectar um Instagram
puramente pessoal por esta integração, então qualquer Página listada já é, por natureza, uma
Página que o usuário administra profissionalmente ou de marca, nunca um perfil pessoal solto.

## Decision Outcome

**Espelhar o padrão de pending-selection do LinkedIn Page para o Meta: nunca auto-escolher
Página quando há mais de uma candidata; adicionar `accountLabel` a `OAuthConnection` para exibir
o nome/@handle da conta de fato conectada.**

### Details

**0 Páginas → conectado com `facebook: null, instagram: null`; 1 Página → auto-conecta (UX
inalterada); >1 Páginas → pending, exige escolha**

Mantém o caminho feliz de quem administra uma única Página idêntico a antes (nenhuma fricção
nova pra maioria dos usuários). Só o caso ambíguo — múltiplas Páginas, exatamente o cenário do
bug relatado — passa a exigir confirmação, seguindo o mesmo contrato de resultado
(`{status: 'connected' | 'pending', ...}`) já validado pelo LinkedIn.

**`persistMetaPageConnection` extraído como função compartilhada**

Tanto o caminho de auto-conexão (1 Página) quanto o de confirmação pós-escolha
(`ConfirmMetaPageSelectionUseCase`) persistem a mesma coisa a partir de uma `MetaPage` — extraído
pra uma função única em vez de duplicar a lógica de gravar `OAuthConnection` + tokens no vault
para Facebook e, condicionalmente, Instagram.

**Pending selection armazenada no token vault com TTL de 10 minutos, chave `meta-page-pending-{id}`**

Mesmo mecanismo já usado pelo LinkedIn Page (`linkedin-page-pending-{id}`): o token de usuário e a
lista de Páginas candidatas ficam no vault, escopados por `userId`, expirando sozinhos se o
usuário nunca voltar para confirmar. `GetPendingMetaPageSelectionUseCase` lista as opções;
`ConfirmMetaPageSelectionUseCase` valida dono + TTL + Página escolhida antes de persistir e então
apaga a entrada pendente.

**`accountLabel` opcional em `OAuthConnection`, não uma tabela separada**

Segue a mesma convenção já usada por campos específicos de plataforma como `organizationUrn`
(opcional, `string | null`) — evita atualizar todo fixture de teste que constrói `OAuthConnection`
só para carregar um detalhe de exibição. Preenchido com `page.name` para Facebook, e
`@{username}` (ou `null` se o Graph API não retornar `username`) para Instagram; o LinkedIn Page
passa a preencher o mesmo campo com o nome da organização, pelo mesmo motivo.

**`instagram_business_account{id,username}` no lugar de só `{id}`**

O campo `username` não vem por padrão na resposta do Graph API — precisa ser pedido
explicitamente na query de `fields` de `getUserPages`. Sem isso, `accountLabel` do Instagram
sempre seria `null`.

**Só o caso `pending` redireciona para `/dashboard/accounts`; `connected`/`error` continuam em
`/dashboard`**

`/dashboard` já trata `connected=`/`error=` há mais tempo e tem seu próprio aviso de
sucesso/erro — mudar esse destino seria uma regressão de escopo maior que o necessário. Só o
seletor de Página (novo, só existe em `/dashboard/accounts`) precisa do redirecionamento novo,
espelhando onde o seletor do LinkedIn já vive.

## What this does not solve

Não corrige retroativamente uma conexão já persistida com a Página errada antes deste fix — o
usuário ainda precisa desconectar (revogar o acesso do app nas configurações do Facebook) e
reconectar para que o novo seletor apareça. Não resolve a limitação estrutural de que Instagram
sempre exige uma conta Business/Creator vinculada a uma Página — um Instagram estritamente
pessoal continua fora do alcance desta integração, por design da própria Graph API.

## References

- [_local-edr-policy-052-lock-contra-corrida-na-linha-do-tempo](052-lock-contra-corrida-na-linha-do-tempo.md) - Bug anterior no mesmo fluxo de publicação de campanhas, relatado pelo mesmo usuário via print de tela
