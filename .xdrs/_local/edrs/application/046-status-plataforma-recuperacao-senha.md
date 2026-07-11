---
name: _local-edr-policy-046-status-de-plataforma-e-senha
description: Documenta a adição do campo status por plataforma em PLATFORM_META e o fluxo de recuperação de senha. Use ao alterar a Central de Contas, adicionar nova plataforma, ou mexer no fluxo de autenticação por email/senha.
apply-to: apps/web — Central de Contas, autenticação
valid-from: 2026-07-11
---

# _local-edr-policy-046: Status de Plataforma e Senha

## Context and Problem Statement

Duas lacunas foram encontradas ao auditar a prontidão do SocialShelf para aceitar usuários externos reais (ver `_local-bdr-policy-012`):

1. Todas as plataformas na Central de Contas mostravam o mesmo botão "Conectar", sem indicar que Instagram, Facebook, TikTok e X ainda dependem de aprovação da própria plataforma para funcionar com qualquer usuário além do dono do app e de testers já cadastrados manualmente.
2. Não existia fluxo de recuperação de senha — um usuário que esquecesse a senha de email/senha não tinha como recuperar acesso.

## Decision Outcome

**Campo `status: 'live' | 'in_review'` em `PLATFORM_META`, exibido como aviso não bloqueante na Central de Contas; página `/forgot-password` usando `sendPasswordResetEmail` do Firebase Auth.**

### Details

**`PLATFORM_META` (`apps/web/src/lib/platformMeta.ts`)**

Cada entrada de plataforma ganhou `status: 'live' | 'in_review'`:
- `live`: LinkedIn — já funciona para qualquer usuário novo, sem aprovação pendente.
- `in_review`: Facebook, Instagram, TikTok, X — dependem de App Review (Meta), Audit (TikTok) ou verificação de tier de API (X).

**Central de Contas (`apps/web/src/app/dashboard/accounts/page.tsx`)**

Plataformas `in_review` sem conexão ativa mostram um aviso âmbar: *"Em análise pela plataforma — a conexão pode falhar se sua conta ainda não foi liberada para testes."* O botão "Conectar" **não é desabilitado** — continua funcionando para o dono do app e para qualquer usuário já adicionado como tester/target user nos respectivos portais de desenvolvedor. Desabilitar o botão quebraria a conexão que já funciona para essas contas; o aviso apenas ajusta a expectativa de quem ainda não foi liberado.

**Atualizar quando uma plataforma for aprovada:** trocar `status: 'in_review'` para `status: 'live'` na entrada correspondente de `PLATFORM_META` — nenhuma outra mudança de código necessária, o aviso desaparece automaticamente.

**Recuperação de senha (`apps/web/src/app/forgot-password/page.tsx`)**

Nova página usando `sendPasswordResetEmail` do Firebase Auth, mesmo padrão de formulário já usado em `/signup` e `/login`. Link adicionado na tela de `/login`. Login via Google não é afetado — não depende de senha própria do SocialShelf.

## Rationale

Aviso não bloqueante é proporcional ao problema: o objetivo é gerenciar expectativa de um usuário novo, não impedir o dono do app ou testers já autorizados de continuar usando a conexão que já funciona para eles. Bloquear o botão exigiria que o frontend soubesse se o usuário atual é tester em cada plataforma — informação que só existe do lado da Meta/TikTok, opaca para o SocialShelf.

## Consequências

**Positivas:**
- Usuário novo entende por que uma conexão falhou, em vez de achar que é bug do SocialShelf.
- Nenhuma regressão para o dono do app ou testers já cadastrados.
- Ativar uma plataforma aprovada é uma troca de valor de config, não uma reimplementação.
- Usuários de email/senha não ficam permanentemente trancados fora da conta por esquecimento de senha.

## References

- [_local-bdr-policy-012-lancamento-multi-usuario](../../bdrs/product/012-lancamento-multi-usuario.md) - Estratégia de lançamento que motivou esta mudança
- [_local-bdr-policy-003-redes-sociais-suportadas](../../bdrs/product/003-redes-sociais-suportadas.md) - Status de integração por plataforma
- [_local-edr-policy-013-firebase-id-token-como-bearer](013-firebase-auth-bearer.md) - Uso do Firebase Auth como base de autenticação
