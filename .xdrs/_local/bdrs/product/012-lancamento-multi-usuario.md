---
name: _local-bdr-policy-012-lancamento-multi-usuario
description: Define a estratégia de abertura de cadastro público do SocialShelf para novos usuários, separando prontidão do próprio produto (já pronta) de prontidão de publicação em cada rede social (depende de aprovação de terceiros). Use ao planejar o lançamento público, priorizar submissões de revisão de plataforma, ou responder "por que um usuário novo não consegue conectar X rede".
apply-to: Onboarding de novos usuários, roadmap de lançamento, submissões de App Review/Audit
valid-from: 2026-07-11
---

# _local-bdr-policy-012: Lançamento Multi-Usuário

## Context and Problem Statement

O SocialShelf nasceu como uso pessoal de um único usuário e está migrando para SaaS com múltiplos usuários pagando mensalidade, cada um isolado dos demais, sem colaboração entre contas (ver histórico de deliberação descartada em `_local-adr-policy-042`, `_local-edr-policy-045` e `_local-bdr-policy-011`, que erroneamente modelou isso como workspace colaborativo).

Existe uma confusão recorrente entre duas camadas distintas: (1) o SocialShelf aceitar novos usuários cadastrados e isolados, e (2) esses usuários conseguirem publicar de verdade nas redes sociais deles através do SocialShelf. A primeira já está pronta; a segunda depende de aprovação de terceiros (Meta, TikTok) que nenhuma mudança de código do SocialShelf resolve sozinha.

Qual é o estado real de prontidão de cada camada, e qual estratégia de lançamento é viável hoje?

## Decision Outcome

**Camada de produto (cadastro, isolamento, uso do sistema) já está pronta e não depende de nenhuma plataforma externa. Camada de publicação está pronta apenas para LinkedIn (perfil pessoal); Instagram, Facebook e TikTok exigem aprovação formal (App Review / Audit) de cada plataforma antes de aceitar qualquer usuário não cadastrado manualmente pelo dono do app; X precisa de verificação de tier de API. Estratégia adotada: abrir cadastro público agora com LinkedIn funcional, enquanto as aprovações das demais correm em paralelo.**

### Details

#### Camada 1 — Produto (já pronta, confirmado em auditoria de código de 2026-07-11)

- Cadastro via email/senha e Google já existe (`apps/web/src/app/signup`, `apps/web/src/app/login`) e é genérico — nenhum código assume um usuário específico.
- Isolamento de dados por `userId` já existe via Firestore rules (`isOwner(userId)`) — confirmado que um usuário novo nunca vê dados de outro.
- `ensureDefaultBrand()` (`apps/api/src/routes/brands.routes.ts`) cria automaticamente uma marca padrão para qualquer `userId` novo, sem intervenção manual.
- Gap encontrado e corrigido nesta rodada: não existia fluxo de recuperação de senha — adicionado em `_local-edr-policy-046`.

**Conclusão:** não há trabalho de código pendente para esta camada. "Preparar o sistema para aceitar novos usuários" já estava feito antes desta deliberação — a lacuna real sempre esteve na camada de publicação.

#### Camada 2 — Publicação em redes sociais de terceiros (depende de aprovação externa)

Meta e TikTok exigem que qualquer app que publique em nome de usuários **não explicitamente cadastrados pelo dono do app** passe por revisão formal:

- **Meta (Instagram + Facebook):** app em "Development Mode" só aceita OAuth de usuários adicionados manualmente como Tester em Meta for Developers → App Roles. Para aceitar qualquer usuário público, o app precisa passar por **App Review** (aprovação por permissão solicitada) e provavelmente **Business Verification** (documento de empresa).
- **TikTok:** app em Sandbox/"não auditado" só aceita usuários adicionados manualmente como Target User, e mesmo esses só publicam em contas configuradas como privadas (`403 unaudited_client_can_only_post_to_private_accounts` — ver `_local-edr-policy-035`). Para produção real, precisa de **App Audit**.
- **X (Twitter):** não tem lista de tester/target user, mas o tier de acesso à API (Free/Basic/Pro) determina se escrita via API está disponível — não confirmado nesta rodada, pendente de verificação manual no X Developer Portal pelo dono da conta.
- **LinkedIn (perfil pessoal):** `openid profile email w_member_social` são escopos padrão que não exigem revisão — já funciona para qualquer usuário novo, sem ação pendente.

Textos de justificativa por permissão e roteiro de vídeo de demonstração para submissão do Meta App Review e do TikTok Audit foram redigidos nesta rodada e entregues fora do controle de versão do repositório (arquivo local `meta-tiktok-app-review-textos.md`, compartilhado diretamente com o usuário) — não arquivados como XDRS por serem conteúdo de formulário externo, não decisão de arquitetura.

#### Bloqueio crítico identificado — CNPJ da Rádio Kactus

`apps/web/src/app/terms/page.tsx` e `apps/web/src/app/privacy/page.tsx` declaram explicitamente: *"CNPJ a ser incluído nesta página assim que o registro formal da empresa for concluído"* — ou seja, a Rádio Kactus não tem CNPJ registrado no momento desta deliberação.

A Meta Business Verification tipicamente exige documento de empresa registrada para aprovar os escopos que o SocialShelf já usa (`instagram_content_publish`, `pages_manage_posts`, `business_management`). **Sem CNPJ, a submissão da Meta pode ser rejeitada ou travar indefinidamente em verificação** — isto não é resolvido por nenhum texto de justificativa, é documentação legal pendente, fora do escopo de qualquer mudança de código ou de produto.

TikTok Audit tende a ser mais tolerante quanto a isso (aceita conta de desenvolvedor pessoa física em alguns casos), mas deve ser confirmado no formulário no momento da submissão.

#### Estratégia de lançamento adotada — "Caminho A"

Entre as opções levantadas (lançar já só com LinkedIn; esperar todas as aprovações antes de lançar; começar as aprovações e decidir a data depois), foi adotada a combinação dos caminhos A e C:

1. Abrir cadastro público agora — usuários novos se cadastram, usam o produto, e publicam de verdade no LinkedIn desde o primeiro dia.
2. Em paralelo, iniciar as submissões de Meta App Review e TikTok Audit assim que o CNPJ estiver disponível — o relógio de revisão dessas plataformas começa a correr sem bloquear o lançamento.
3. Instagram, Facebook, TikTok e X aparecem na Central de Contas com aviso "Em análise pela plataforma" (`_local-edr-policy-046`) em vez de escondidos — evita esconder o roadmap, mas avisa a expectativa correta.
4. Quando cada plataforma aprovar, remover o aviso trocando `status: 'in_review'` para `status: 'live'` em `PLATFORM_META` — nenhuma outra mudança de código é necessária.

## Rationale

Separar as duas camadas evita o erro recorrente de tratar prontidão de publicação em rede social de terceiro como se fosse configuração interna do SocialShelf. A estratégia de lançar já com LinkedIn evita bloquear o produto inteiro por uma aprovação que está fora do controle do time de engenharia, enquanto ainda comunica corretamente ao usuário o que está e o que não está disponível.

## Consequências

**Positivas:**
- Lançamento não fica refém do cronograma de aprovação de terceiros.
- Usuário novo nunca é surpreendido por um erro sem explicação ao tentar conectar uma rede em revisão.
- Regularizar plataformas aprovadas no futuro é uma mudança de configuração (`status: 'live'`), não uma reimplementação.

**Negativas:**
- Usuários que precisam de Instagram/TikTok desde o dia 1 ficam sem essa funcionalidade até a aprovação sair.
- CNPJ pendente é um bloqueio fora do controle de engenharia — pode adiar indefinidamente a submissão da Meta se não for resolvido.

## References

- [_local-bdr-policy-003-redes-sociais-suportadas](003-redes-sociais-suportadas.md) - Status de integração por plataforma, atualizado nesta rodada
- [_local-edr-policy-046-status-de-plataforma-e-senha](../../edrs/application/046-status-plataforma-recuperacao-senha.md) - Mudanças de código desta rodada
- [_local-edr-policy-035-upload-de-video-para-tiktok-mvp-sincrono](../../edrs/application/035-upload-video-tiktok-mvp-sincrono.md) - Restrição de conta privada para apps não auditados do TikTok
- [_local-adr-policy-038-selecao-de-pagina-conexao-multi-marca](../../adrs/integration/038-selecao-pagina-conexao-multi-marca.md) - Bloqueio estrutural equivalente já enfrentado no LinkedIn Community Management API
- [_local-adr-policy-042-arquitetura-multi-tenant-workspace](../../adrs/application/042-arquitetura-multi-tenant-workspace.md) - Deliberação descartada por partir de entendimento incorreto do pedido (colaboração, não isolamento)
