---
name: _local-adr-policy-042-login-com-google-via-identity-services
description: Documenta a troca do login com Google de signInWithRedirect/signInWithPopup do Firebase Auth para Google Identity Services + signInWithCredential. Use ao revisar, depurar ou estender o fluxo de autenticação de usuário via Google no apps/web.
apply-to: Autenticação de usuário via Google em apps/web (login e signup)
valid-from: 2026-07-12
---

# _local-adr-policy-042: Login com Google via Identity Services

## Context and Problem Statement

O login com Google em `socialshelf.com.br` usava `signInWithRedirect`/`getRedirectResult` do Firebase Auth. No Safari, o fluxo completava a autenticação no Google mas `getRedirectResult()` sempre resolvia `null`, sem erro capturável, mesmo depois de configurar um `authDomain` customizado no mesmo eTLD+1 do app (`auth.socialshelf.com.br`) e corrigir a lista de Authorized domains do Firebase Auth.

Qual mecanismo deve ser usado para obter a credencial do Google de forma confiável entre navegadores, sem depender de um canal de armazenamento cross-origin sujeito a bloqueio?

## Decision Outcome

**Google Identity Services (`accounts.google.com/gsi/client`) obtém o ID token diretamente no navegador; `signInWithCredential` completa o login no Firebase Auth**

O app não usa mais `signInWithRedirect`/`signInWithPopup`/`getRedirectResult` do Firebase Auth para o provedor Google. Em vez disso, renderiza o botão oficial do Google via Google Identity Services, recebe o ID token no callback e chama `signInWithCredential(auth, GoogleAuthProvider.credential(idToken))`.

### Details

- Causa raiz do bug anterior: o `BrowserPopupRedirectResolver` do `@firebase/auth` recupera o resultado do redirect através de um iframe cross-origin oculto (`_openIframe`/`gapi.iframes`, apontando para o `authDomain`), que troca mensagens via `postMessage`. Esse iframe embutido é bloqueado pelo particionamento de armazenamento de terceiros do WebKit mesmo quando o `authDomain` está no mesmo eTLD+1 do app — a exceção de "mesmo site" do Safari se aplica à navegação de topo, não ao contexto de iframe embutido. Não existe correção de configuração para isso; é uma limitação estrutural do redirect/popup resolver do Firebase Auth.
- Implementação centralizada em `apps/web/src/components/GoogleSignInButton.tsx`, reutilizada por `login/page.tsx` e `signup/page.tsx`. Recebe `onSuccess`/`onError` como props; não expõe estado de erro genérico — quem chama decide como exibir.
- Requer duas variáveis distintas no mesmo OAuth Client do Google Cloud (`Web client (auto created by Google Service)`, projeto `socialshelf-547da`):
  - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (novo GitHub secret) — Client ID usado pelo Google Identity Services no navegador.
  - `https://socialshelf.com.br` deve estar em **Authorized JavaScript origins** do mesmo client — distinto de Authorized redirect URIs (que valida o `authDomain` do Firebase, ainda necessário para outros usos do Firebase Auth). Faltar essa entrada produz `Erro 400: origin_mismatch`, bloqueando o carregamento do botão.
- `email`/senha (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`) não muda — só o provedor Google foi afetado.
- O `authDomain` customizado (`auth.socialshelf.com.br`, ver `_local-adr-policy-039`) permanece configurado; não é revertido por esta decisão, pois outras operações do Firebase Auth (ex: link de redefinição de senha) ainda podem depender dele.

## Considered Options

* (REJECTED) **Insistir em `signInWithRedirect` com authDomain customizado** — eTLD+1 compartilhado não é suficiente porque o ponto de falha é o iframe embutido usado para recuperar o resultado, não a navegação de topo.
* (REJECTED) **`signInWithPopup`** — usa o mesmo canal de iframe internamente (`_isIframeWebStorageSupported`); teria ao menos um erro capturável (`auth/web-storage-unsupported`) em vez de retorno silencioso, mas não resolveria o login no Safari.
* (CHOSEN) **Google Identity Services + `signInWithCredential`** — obtém o ID token sem depender de nenhum canal cross-origin controlado pelo Firebase; é o mecanismo atual recomendado pelo Google para "Sign in with Google".

## References

- [_local-adr-policy-039-dominio-radiokactus-com-dns-e-roteamento](039-dominio-radiokactus-dns-roteamento.md) - Narrativa completa da investigação (authDomain customizado, Authorized domains, causa raiz do iframe) que precedeu esta decisão
- [_local-adr-policy-010-gcp-infrastructure-baseline](010-gcp-infrastructure.md) - Firebase Auth como detalhe de infraestrutura
