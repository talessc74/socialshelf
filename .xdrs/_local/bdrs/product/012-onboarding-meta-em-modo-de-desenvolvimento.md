---
name: _local-bdr-policy-012-onboarding-meta-em-modo-de-desenvolvimento
description: Define como o SocialShelf lida com conexões de Instagram/Facebook enquanto o app da Meta segue em modo de desenvolvimento (sem App Review aprovado) — allowlist manual de testadores, comunicação honesta na Central de Contas, e gate de lançamento público até a revisão passar. Use ao mexer no fluxo de conexão OAuth Meta, em Central de Contas, ou ao decidir se um usuário pessoa física pode ser onboardado.
apply-to: apps/web — Central de Contas e fluxo de onboarding; apps/api — rotas OAuth Meta; decisões de produto sobre abertura de cadastro
valid-from: 2026-07-21
---

# _local-bdr-policy-012: Onboarding Meta em Modo de Desenvolvimento

## Context and Problem Statement

Investigação de produção (sessão de 21/07/2026) confirmou que uma conta pessoal do Instagram convertida para profissional (Business/Creator) ainda assim não conseguia publicar via SocialShelf — erro `OAuthException code 190`. A causa raiz tinha duas camadas, não uma: (1) exigência da Meta de conta profissional, já resolvida pelo usuário; e (2) o app "SocialShelf" na Meta nunca passou por App Review e segue em modo de desenvolvimento, onde a Graph API só autoriza permissões avançadas (`instagram_business_content_publish`, `pages_manage_posts` etc.) para contas cadastradas manualmente como Tester/Admin/Developer do app — qualquer outra conta, profissional ou não, recebe o mesmo erro de permissão.

A submissão do App Review está bloqueada por uma pendência de negócio (regularização do CNPJ da Rádio Kactus, exigida pela Business Verification da Meta) já rastreada no Roadmap — fora do controle de engenharia.

O próprio fundador, com acesso direto a troubleshooting assistido, levou múltiplas sessões para diagnosticar e resolver a própria conexão. Como o SocialShelf deve lidar com conexões de contas pessoais do Instagram/Facebook enquanto o app segue em modo de desenvolvimento, sem repetir essa mesma fricção para qualquer outro usuário que tentar se cadastrar?

## Decision Outcome

**Allowlist manual de testadores enquanto durar o modo de desenvolvimento, com a limitação comunicada de forma explícita na interface — cadastro público de contas pessoais só abre depois que o App Review for aprovado.**

A regularização do CNPJ e a submissão do App Review permanecem a prioridade que resolve isto na raiz; enquanto isso não acontece, o produto não finge que qualquer conta consegue conectar.

### Details

**Regularização do CNPJ / App Review é a única solução real — não há atalho de engenharia**
Nenhuma mudança de código no SocialShelf contorna a exigência de App Review da Meta para contas fora da allowlist de testadores. Tratar isso como item de prioridade máxima do Roadmap (já está) é a ação que efetivamente destrava o onboarding público — o resto desta policy é só como operar *durante* a espera.

**Enquanto em modo de desenvolvimento, só se publica via allowlist manual de testadores**
Para qualquer conta (pessoal ou de marca-piloto) que precise publicar antes do App Review passar, o cadastro como testador é um processo de dois passos que precisa ser seguido por completo:
1. Adicionar a conta como Tester/Admin/Developer no app da Meta (developers.facebook.com → Funções do app; ou, no fluxo de Instagram Login direto, em Instagram Testers).
2. A própria conta precisa **aceitar o convite pelo lado do Instagram** (Configurações → Apps e sites → Convites de testador) — passo que não é automático e é a causa mais comum de "cadastrei mas continua sem funcionar".
Sem os dois passos completos, a conexão OAuth pode até ser concluída (o SocialShelf salva um token), mas a publicação falha com o mesmo erro de permissão — reproduzindo o sintoma original.

**Central de Contas deve avisar antes de conectar, não só depois de falhar**
O aviso já existente sobre conta Business/Creator (`Antes de conectar o Instagram ou o Facebook`) não menciona a exigência de allowlist de testador. Enquanto o app estiver em modo de desenvolvimento, esse aviso precisa deixar explícito que só contas liberadas manualmente conseguem publicar agora, evitando que um usuário sem saber disso converta a conta, conecte, e só descubra o problema real na tentativa de publicar.

**Mensagens de erro continuam no padrão iniciado em `MetaPublisher.friendlyReason`**
Erros de permissão (`code 190`) já são traduzidos para ação clara em vez do JSON cru da Graph API. Qualquer nova causa de falha de publicação identificada deve seguir o mesmo padrão — mensagem específica e acionável, nunca o corpo técnico da API exposto ao usuário final.

**Gate de lançamento público: cadastro aberto de contas pessoais só depois do App Review aprovado**
Até lá, onboarding de conta pessoal fora da allowlist manual não deve ser divulgado nem aberto como fluxo self-service — o produto reproduziria, para cada novo usuário, a mesma investigação de múltiplas sessões que o fundador precisou fazer na própria conta.

**Antes do lançamento amplo, QA de onboarding com um usuário leigo real**
Depois do App Review aprovado, validar o fluxo completo (converter conta → conectar → publicar) com alguém sem conhecimento técnico do produto, usando a fricção real relatada nesta sessão como critério de aceite.

## What this does not solve

Não elimina a exigência da Meta de conta Business/Creator, nem acelera o processo de Business Verification/App Review em si — ambos são constraints da plataforma Meta, compartilhados por qualquer concorrente que publique via API do Instagram/Facebook. Também não cobre LinkedIn/X/TikTok, que têm processos de revisão e limitações próprios, fora do escopo desta policy.

## References

- [_local-bdr-policy-009-contas-pessoal-e-profissional](009-contas-pessoal-profissional-cobranca.md) - Modelo de accountType que esta policy assume ao falar em "conta pessoal"
- `apps/publisher/src/infrastructure/publishers/MetaPublisher.ts` (`friendlyReason`) - Padrão de tradução de erro que esta policy referencia
- `apps/web/src/app/dashboard/accounts/page.tsx` - Aviso atual sobre conta Business/Creator, a ser estendido com o aviso de allowlist
- Roadmap Notion: "Submeter Meta App Review (Instagram + Facebook)" (status: Bloqueado) e "Regularizar CNPJ da Rádio Kactus" - Pendências de negócio que destravam esta policy
