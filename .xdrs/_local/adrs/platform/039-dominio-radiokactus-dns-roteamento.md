---
name: _local-adr-policy-039-dominio-radiokactus-com-dns-e-roteamento
description: Documenta o estado real do DNS de radiokactus.com — registrador, entradas conflitantes na raiz e qual provedor de fato responde pelo domínio hoje. Use antes de configurar verificação de propriedade de domínio em integrações de terceiros (TikTok, Meta, etc.) ou ao planejar a migração para socialshelf.com.br.
apply-to: DNS de radiokactus.com; verificação de propriedade de domínio (Terms/Privacy URL, OAuth) em integrações de terceiros; planejamento de migração para socialshelf.com.br
valid-from: 2026-07-06
---

# _local-adr-policy-039: Domínio radiokactus.com — DNS e Roteamento

## Context and Problem Statement

Nenhuma policy XDRS descrevia para onde o DNS de `radiokactus.com` de fato
aponta. Essa lacuna só ficou visível ao configurar a verificação de URL do
app TikTok for Developers, que exige saber com certeza qual serviço responde
pelas URLs cadastradas (`WEB_URL=https://radiokactus.com`, usado como origem
de CORS desde `_local-edr-policy-011-cors-policy`).

Para onde o domínio `radiokactus.com` aponta hoje, e qual dessas entradas é
a autoritativa?

## Decision Outcome

**Registrador é Hostgator; a raiz do domínio hoje é respondida pela
infraestrutura do Google (Cloud Run), não pelo Vercel — apesar de existir
uma entrada Vercel não removida na zona.**

Isto é um registro de estado real observado em 2026-07-06, não uma decisão
de arquitetura nova.

### Details

**Entradas observadas na zona (raiz, salvo indicação contrária)**

| Nome | Tipo | Valor | Origem |
|---|---|---|---|
| (raiz) | A | `216.239.34.21` | Manual |
| (raiz) | A | `216.239.32.21` | Manual |
| `eai` | CNAME | `ghs.googlehosted.com.` | Manual, propósito não estabelecido nesta revisão |
| (raiz) | TXT | `google-site-verification=...` | Manual, propósito não estabelecido nesta revisão |
| (raiz) | CAA | `pki.goog` / `sectigo.com` / `letsencrypt.org` | Manual |
| `*` (wildcard) | ALIAS | `cname.vercel-dns-017.com.` | Auto-adicionada pelo Vercel |
| (raiz) | ALIAS | `cname.vercel-dns-017.com.` | Auto-adicionada pelo Vercel |

**Resolução real confirmada (2026-07-06)**

`getent hosts radiokactus.com` devolveu IPs da faixa `2001:4860:4802::/...`
— a mesma família dos dois A records manuais acima, que correspondem aos IPs
de front-end do Google usados em mapeamento de domínio customizado do Cloud
Run. **A raiz do domínio é respondida pelo Google (Cloud Run `web-service`),
não pelo Vercel**, apesar da entrada ALIAS do Vercel existir na zona.

Conclusão prática: qualquer arquivo servido por `apps/web` (ex: páginas de
verificação de URL de terceiros) é alcançável em `https://radiokactus.com/*`
via deploy normal do `web-service`, sem depender de nada no Vercel.

## Riscos e Drift

- **Apenas 2 dos 4 IPs de front-end recomendados pelo Google** para
  mapeamento de domínio customizado do Cloud Run estão presentes
  (`216.239.32.21`, `216.239.34.21` — faltam `.36.21` e `.38.21`). Reduz a
  redundância; se um dos dois presentes ficar inalcançável, não há os
  outros dois como fallback. Correção é uma ação de DNS que exige acesso ao
  painel — não é algo que o deploy via CI resolve.
- **Entrada Vercel na raiz é legado não removido.** Não é autoritativa hoje
  (a resolução real aponta para o Google), mas sua permanência na zona é um
  risco silencioso: se os dois A records manuais forem removidos ou a
  ordem de precedência do provedor de DNS mudar, o tráfego pode passar a
  ser servido pelo Vercel sem aviso. Decisão sobre remover essa entrada ou
  documentar por que ela deve permanecer cabe a quem administra o domínio
  — não foi tomada nesta revisão.
- `eai` (CNAME) e o TXT `google-site-verification` na raiz têm propósito
  não estabelecido nesta revisão (podem ser de um serviço Google não
  relacionado ao SocialShelf, ex: Search Console ou Workspace). Não foram
  alterados.

## Atualização — migração para socialshelf.com.br em andamento (2026-07-11)

A migração planejada (ver referência à BDR-010 abaixo) começou a sair do papel. Estado observado nesta data:

**DNS de `socialshelf.com.br` — já ativo, nenhuma ação pendente**

O domínio foi registrado no registro.br (NS: `a.sec.dns.br` / `c.sec.dns.br`) e já está mapeado como domínio customizado do Cloud Run (`web-service`, `us-central1`, projeto `socialshelf-547da`) desde ~10 dias antes desta revisão. Ao contrário de `radiokactus.com` (ver riscos acima), aqui os 4 IPs de front-end recomendados pelo Google estão todos presentes:

| Tipo | Valores |
|---|---|
| A | `216.239.32.21`, `216.239.34.21`, `216.239.36.21`, `216.239.38.21` |
| AAAA | `2001:4860:4802:32::15`, `2001:4860:4802:34::15`, `2001:4860:4802:36::15`, `2001:4860:4802:38::15` |

Mapeamento confirmado com status ativo (certificado provisionado e verificado) e resolução real conferida via DNS-over-HTTPS. Sem entrada legada de outro provedor nesta zona (diferente de `radiokactus.com`, que ainda carrega o ALIAS Vercel não removido).

**OAuth — migração parcial dos redirect URIs cadastrados nos apps de terceiros**

Redirect URIs de `https://api.socialshelf.com.br/...` foram adicionadas (mantendo as de `radiokactus.com` em paralelo, sem remoção):

- Meta for Developers — ✅ adicionado
- X (Twitter) Developer Portal (app 33038648) — ✅ adicionado
- LinkedIn Developer Portal — ✅ adicionado nos dois apps existentes: "SocialShelf" (pessoal, `linkedin/callback`) e "SocialShelf Pages" (`linkedin-page/callback`)
- TikTok for Developers — ✅ concluído manualmente pelo usuário (login via Chrome do Cowork apresentava erro anômalo de "conta não existe", suspeita de detecção de automação pelo anti-bot do TikTok):
  - Redirect URI `https://api.socialshelf.com.br/oauth/tiktok/callback` já presente no Sandbox-1.
  - App details (Sandbox-1) atualizado: Terms of Service, Privacy Policy e Web/Desktop URL apontam agora para `socialshelf.com.br`.
  - Verificação de domínio do Content Posting API (pull_by_url, ver `_local-edr-policy-035`) — tipo "Domain", método DNS TXT record. Registro `tiktok-developers-site-verification=YgzlKtkb1M4hAC34VA1KSYCXwjCZ8FBA` adicionado na raiz da zona DNS de `socialshelf.com.br` (via Cowork, registro.br) e verificado com sucesso ("Your property has been verified").

Com isso, **todas as 4 integrações OAuth e a verificação de domínio do TikTok já migraram para `socialshelf.com.br`.** Falta apenas confirmar se "Apply changes" foi salvo no Sandbox-1 do TikTok, e então aplicar as mudanças de código (`WEB_URL`, `NEXT_PUBLIC_API_URL`, e-mail em terms/privacy, fallback do publisher).

**Drift de deploy — `--set-env-vars` com vírgula dentro do valor de `CORS_ORIGINS` quebra o parsing do gcloud (2026-07-12)**

Ao introduzir `CORS_ORIGINS=https://socialshelf.com.br,https://radiokactus.com` no `api-service` (`_local-edr-policy-011`), o deploy #269 falhou no step "Deploy api-service to Cloud Run" com `Bad syntax for dict arg: [https://radiokactus.com]`. Causa: `gcloud run deploy --set-env-vars` usa vírgula como separador entre pares `KEY=VALUE`; uma vírgula dentro do próprio valor quebra o parsing — o mesmo problema que o `generator-service` já contornava para `TRUSTED_NEWS_DOMAINS` usando delimitador alternativo (`--set-env-vars="^#^${VARS}"`, com `#` no lugar de `,` entre variáveis). Corrigido aplicando o mesmo padrão ao `api-service`: delimitador trocado para `;` (`--set-env-vars="^;^${VARS}"`), liberando a vírgula para uso dentro do valor de `CORS_ORIGINS`.

**Consequência**: o deploy #269 (commit `f5e33a7`) buildou e passou em todos os outros serviços (web, generator, publisher), mas o `api-service` nunca recebeu o código novo — continuou rodando a imagem anterior, sem a variável `CORS_ORIGINS` (só aceitando `radiokactus.com`). Isso não afeta a página em si nem o login com Google (que fala direto com Firebase/Google, sem passar pelo `api-service`), mas quebraria qualquer chamada autenticada do frontend em `socialshelf.com.br` pro `api-service` (buscar perfil de marca, conexões, etc.) até o deploy seguinte corrigir o delimitador.

**Código ainda não migrado — intencional**

`WEB_URL`, `NEXT_PUBLIC_API_URL` (ambos em `deploy.yml`) e o fallback hardcoded em `apps/publisher/src/routes/publish.routes.ts` continuam apontando para `radiokactus.com`, assim como o e-mail de contato em `terms/page.tsx` e `privacy/page.tsx`. Decisão deliberada: não trocar `WEB_URL`/CORS para `socialshelf.com.br` em produção antes de LinkedIn e TikTok aceitarem o redirect novo — trocar antes quebraria OAuth dessas duas plataformas.

**Meta App Review — bloqueio não relacionado a DNS**

Fora do escopo desta ADR: a submissão à Meta Business Verification está bloqueada pela falta de CNPJ regularizado da Rádio Kactus, independente do estado do domínio.

**Login com Google no Safari — causa raiz confirmada e correção em andamento (2026-07-12)**

Após migrar `signInWithPopup` para `signInWithRedirect` (ver `_local-edr-policy-011`), o login com Google em `socialshelf.com.br` continuava falhando no Safari (completa a ida ao Google, `getRedirectResult()` retorna `null` sem erro). Causa raiz confirmada via instrumentação de debug: o Safari (ITP) particiona o armazenamento usado pelo Firebase Auth para completar o redirect, porque o `authDomain` do projeto (`socialshelf-547da.firebaseapp.com`) é um domínio de terceiro em relação a `socialshelf.com.br` — problema documentado pelo próprio Firebase ("Redirect best practices for authentication"), que afeta qualquer domínio usando o `authDomain` padrão, não é exclusivo de `socialshelf.com.br` (também afetaria `radiokactus.com` sob o mesmo teste, nunca verificado).

Correção: subdomínio próprio `auth.socialshelf.com.br` configurado como domínio customizado do Firebase Hosting (mesmo eTLD+1 do app — Safari trata como primeira parte, não particiona). Passos concluídos:
1. Firebase Hosting bootstrado — nunca tinha um site implantado neste projeto (ver seção "Firebase Hosting bootstrado" em `_local-adr-policy-010`).
2. `auth.socialshelf.com.br` cadastrado no Hosting via modo "Configuração rápida" — um único CNAME resolve verificação + conexão: `auth.socialshelf.com.br CNAME socialshelf-547da.web.app`, adicionado no registro.br sem tocar nenhum registro existente.
3. Verificação de DNS concluída automaticamente assim que o CNAME propagou.
4. Certificado SSL provisionado ("Connected"), `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` trocado para `auth.socialshelf.com.br` e `web-service` redeployado.

**O `authDomain` customizado não foi suficiente sozinho — duas causas adicionais, reais, descobertas com evidência (2026-07-12)**

Depois do passo 4 acima, o login continuava falhando igual (Safari **e também Chrome**, o que descartou a teoria de que fosse exclusivamente ITP/Safari). Duas causas reais, confirmadas uma a uma antes de qualquer tentativa de correção:

1. **`auth.socialshelf.com.br` faltava em Authentication → Settings → Authorized domains** (lista própria do Firebase Auth, separada da lista de redirect URIs do OAuth Client do Google Cloud). Sem isso, a própria página `__/auth/handler` recusa a origem e nem chega a redirecionar pro Google. Confirmado via chamada direta a `GET https://identitytoolkit.googleapis.com/v1/projects?key=<apiKey>` (endpoint público, sem necessidade de navegador) antes e depois da correção. Corrigido pelo Cowork; resolveu o Chrome, mas não o Safari.
2. **No Safari, mesmo alcançando o Google e completando o login, `getRedirectResult()` continuava resolvendo `null`.** Causa raiz identificada lendo o código-fonte do `@firebase/auth` instalado (`node_modules`): o SDK recupera o resultado do redirect através de um iframe cross-origin oculto (`BrowserPopupRedirectResolver` → `_openIframe`/`gapi.iframes`, apontando para `auth.socialshelf.com.br`), que troca mensagens via `postMessage` — mecanismo sensível a bloqueio de armazenamento de terceiros no WebKit, mesmo com `authDomain` no mesmo eTLD+1 do app (a partição do Safari se aplica ao contexto de iframe embutido, não apenas à navegação de topo). Não há correção de configuração para isso — é uma limitação estrutural do `signInWithRedirect`/`signInWithPopup` do Firebase Auth combinado com Safari.

**Correção definitiva — Google Identity Services substitui o redirect/popup resolver do Firebase (2026-07-12)**

Trocada a forma de obter a credencial do Google: em vez de `signInWithRedirect`/`getRedirectResult` (que dependem do iframe acima), o app agora usa o **Google Identity Services** (`accounts.google.com/gsi/client`, o mecanismo atual do "Sign in with Google") para obter o ID token direto no navegador, e então `signInWithCredential(auth, GoogleAuthProvider.credential(idToken))` para completar o login — sem depender do iframe/redirect resolver do Firebase em nenhum momento. Implementado em `apps/web/src/components/GoogleSignInButton.tsx`, reutilizado por `login` e `signup`. Precisou de mais uma peça de configuração real, também descoberta por erro concreto (`Erro 400: origin_mismatch`) e não por suposição: `https://socialshelf.com.br` precisou ser adicionado em **Authorized JavaScript origins** do mesmo OAuth Client (distinto de Authorized redirect URIs, que valida o `authDomain`; JavaScript origins valida a página que chama o SDK do Google diretamente). Confirmado funcionando em Safari e Chrome (iPhone) em 2026-07-12, após propagação da mudança de origem (levou uma tentativa a mais na primeira vez).

Requer a variável `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Client ID OAuth do mesmo "Web client" usado pelo Firebase Auth) como GitHub secret — já cadastrada.

A instrumentação de debug temporária (mensagens `Debug: ...` em `login/page.tsx`/`signup/page.tsx`) foi removida junto com a troca, já que o fluxo antigo (`signInWithRedirect`) deixou de ser usado.

## References

- [_local-adr-policy-010-gcp-infrastructure-baseline](010-gcp-infrastructure.md) - Cloud Run como runtime do `web-service` que hoje responde por este domínio
- [_local-edr-policy-011-cors-policy](../../edrs/application/011-cors-policy.md) - `WEB_URL=https://radiokactus.com` como origem de CORS
- [_local-bdr-policy-010-paleta-do-logo-nova-identidade-visual](../../bdrs/product/010-paleta-logo-identidade-visual.md) - Migração planejada para domínio próprio `socialshelf.com.br`
