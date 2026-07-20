---
name: _local-edr-policy-057-login-do-instagram-sem-facebook
description: Novo caminho de conexão do Instagram via "Login do Instagram" (Instagram API with Instagram Login) — sem conta nem Página do Facebook. O vault grava auth_kind instagram_login e publisher/analytics passam a falar com graph.instagram.com usando o token da própria conta quando esse marcador está presente. Use ao mexer no fluxo OAuth do Instagram, no MetaPublisher/MetaAnalyticsReader ou na Central de Contas.
apply-to: apps/api — instagram-client.ts, GenerateInstagramAuthUrlUseCase, HandleInstagramCallbackUseCase, instagram.routes.ts; apps/publisher — MetaPublisher, MetaAnalyticsReader; apps/web — dashboard/accounts/page.tsx, lib/api.ts; .github/workflows/deploy.yml
valid-from: 2026-07-20
---

# _local-edr-policy-057: Login do Instagram sem Facebook

## Context and Problem Statement

Pergunta do usuário que originou a mudança: "Se a pessoa não tem Facebook, como ela conecta a
conta dela do Instagram?" — na implementação até então, não conectava. O único caminho era o
Facebook Login (`meta-client.ts`): exige uma Página do Facebook, e o Instagram só conecta como
apêndice de uma Página com conta Business vinculada. Um creator que só tem Instagram (a maioria)
tinha que criar conta no Facebook + Página só pra usar o produto.

A Meta oferece desde 2024 a **Instagram API with Instagram Login**: uma conta profissional
(Business/Creator) do Instagram autoriza e publica diretamente, sem nenhum vínculo com Facebook.
A única exigência que permanece — de qualquer caminho, por regra da Meta — é a conta ser
profissional; converter é grátis, feito no próprio app do Instagram.

## Decision Outcome

**Adicionar o Login do Instagram como caminho paralelo de conexão (não substituto), com o vault
marcando `auth_kind: 'instagram_login'` para publisher e analytics escolherem host e token.**

### Details

**Cliente próprio (`instagram-client.ts`), não uma extensão do `meta-client.ts`**

Os endpoints são de domínios diferentes (autorização em `www.instagram.com/oauth/authorize`,
troca de code em `api.instagram.com/oauth/access_token`, Graph em `graph.instagram.com`), com
app id/secret próprios (produto "Instagram" no painel da Meta, env `INSTAGRAM_APP_ID`/
`INSTAGRAM_APP_SECRET`/`INSTAGRAM_REDIRECT_URI`) e scopes próprios (`instagram_business_basic`,
`instagram_business_content_publish` — nomes vigentes desde a renomeação de dez/2024). Misturar
no meta-client só acoplaria dois fluxos que não compartilham nada além do conceito.

**Fluxo simples: sem Página, sem pending-selection**

`HandleInstagramCallbackUseCase` espelha a estrutura do fluxo Meta (validateState, marcador de
step nos erros, saneamento de expires_in com fallback de 60 dias), mas termina direto: não há
lista de Páginas pra escolher — o token já é da conta específica que logou. `accountLabel`
recebe `@username` (via `graph.instagram.com/me?fields=user_id,username`).

**`auth_kind: 'instagram_login'` no vault decide host e token na leitura**

O mesmo `tokenRef` (`oauth-token-{pairwiseId}`) pode conter o formato legado
(`page_access_token` + `instagram_business_account_id`, do Facebook Login) ou o novo
(`access_token` + `instagram_user_id` + `auth_kind`). `MetaPublisher` e `MetaAnalyticsReader`
resolvem na leitura: com o marcador, falam com `graph.instagram.com` usando o token direto; sem
ele, comportamento legado intacto. Os endpoints de publicação (container `/media`, polling de
`status_code`, `/media_publish`, carrossel) e de métricas (`/insights`) têm o mesmo formato nos
dois hosts — só mudam host e credencial. Reconectar por um caminho sobrescreve o outro
(mesmo pairwiseId/tokenRef): a conexão do Instagram é uma só, o que muda é como foi autorizada.

**Central de Contas: botão "Conectar sem Facebook" no card do Instagram**

O botão principal "Conectar" continua indo pelo Facebook Login (conecta Facebook e Instagram
juntos, via Página). O card do Instagram ganha o botão secundário "Conectar sem Facebook"
("Reconectar sem Facebook" quando já conectado) — mesmo padrão do botão extra de Página do
LinkedIn. O aviso prévio (_local-edr-policy-055) foi reescrito: o pré-requisito universal é só
conta profissional; a Página do Facebook passa a ser exigência apenas do caminho tradicional.

**Sem refresh automático de token (paridade com o fluxo Meta)**

O token de longa duração vale ~60 dias, igual ao do Facebook Login, e o fluxo atual do Meta
também não faz refresh automático — a conexão expira e o usuário reconecta. O endpoint de
refresh (`graph.instagram.com/refresh_access_token`) existe e fica como evolução futura, para os
dois caminhos de uma vez.

## What this does not solve

Exige configuração única fora do código antes de funcionar em produção: adicionar o produto
"Instagram API with Instagram Login" ao app no painel da Meta, cadastrar o redirect URI
(`https://api.socialshelf.com.br/oauth/instagram/callback`) e criar os secrets
`INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` no GitHub (o deploy já injeta os três env). Advanced
Access das permissões `instagram_business_*` via App Review continua sendo portão da Meta para
usuários sem papel no app. Não conecta perfil pessoal (regra da Meta, sem exceção). Stories,
vídeo/Reels e marcação de produtos ficam fora — o pipeline continua publicando imagem/carrossel
como antes.

## References

- [_local-adr-policy-024-instagram-publicacao-em-duas-etapas](../../adrs/integration/024-instagram-publicacao-duas-etapas.md) - Fluxo de container em duas etapas, idêntico nos dois hosts
- [_local-edr-policy-055-orientacao-de-conta-do-instagram](055-orientacao-de-conta-do-instagram.md) - Aviso prévio da Central de Contas que esta policy atualiza
- [_local-adr-policy-009-oauth-exclusivo-redes-sociais](../../adrs/integration/009-oauth-social-networks.md) - OAuth como modelo único de acesso às redes
