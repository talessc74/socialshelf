---
name: _local-edr-policy-075-cache-preso-na-conta-anterior-ao-trocar
description: O QueryClient de apps/web é um singleton por aba (criado uma vez em Providers.tsx, staleTime 30s) cujas chaves de query não incluem o uid/brandId ativo. Trocar de conta Google (sair e entrar com outro login) deixava o cache servindo dados da conta anterior até um F5 forçar tudo a remontar, mesmo com o token e o uid já trocados — AuthProvider agora limpa o QueryClient sempre que o uid muda de um valor não-nulo para outro. Use ao mexer em AuthContext, Providers.tsx, ou em qualquer novo cache/estado global que não seja escopado por usuário.
apply-to: apps/web — contexts/AuthContext.tsx, components/Providers.tsx
valid-from: 2026-08-04
---

# _local-edr-policy-075: Cache preso na conta anterior ao trocar

## Context and Problem Statement

Usuário reportou: com duas contas Google ativas (uma pessoal, outra "Eai Jurídico"), toda vez
que trocava de conta — saindo e entrando com outro login — o conteúdo da conta anterior
continuava aparecendo na tela, mesmo já autenticado com as credenciais novas. Só um F5 forçava
a tela a assumir a conta certa.

`AuthContext` (via `onAuthStateChanged` do Firebase) e `BrandContext` já reagiam corretamente à
troca — `user` e `activeBrandId` mudavam de valor assim que o novo login completava. O problema
não era autenticação nem qual marca ficava ativa: era o cache do React Query. `Providers.tsx`
cria um único `QueryClient` por sessão de aba (`useState(() => new QueryClient(...))`, `staleTime:
30_000`), e as chaves de query de cada tela (`['performance-suggestions']`, `['brand-profile']`,
etc.) não incluem `user.uid` nem `brandId`. Resultado: ao montar de novo os componentes da
dashboard após o login da segunda conta, o React Query respondia na hora com os dados **em
cache da conta anterior** (ainda dentro do `staleTime`), sem esperar o refetch — e como as
telas não desmontam/remontam sozinhas nessa troca (sem F5), o refetch em background também não
era garantido a disparar de imediato.

## Decision Outcome

**`AuthProvider` chama `queryClient.clear()` sempre que o `uid` do `onAuthStateChanged` muda de
um valor para outro — ignorando a primeira notificação (carregamento inicial da aba) e
notificações repetidas do mesmo usuário (ex.: refresh de token).**

### Details

**Por que no `AuthProvider`, não no `BrandProvider`**

`BrandProvider` já reage à troca de `user` e refaz `getBrands()`/`activeBrandId` — mas ele só
sabe sobre marcas, não sobre as dezenas de outras queries do app (posts, insights,
performance, campanhas, gastos de IA, etc.). O `AuthProvider` é o único lugar que já observa a
identidade do usuário na raiz da árvore, e via `useQueryClient()` (disponível porque
`AuthProvider` já roda dentro de `QueryClientProvider` em `Providers.tsx`) consegue limpar o
cache inteiro de uma vez, sem precisar listar/manter uma lista de query keys sensíveis a conta.

**`queryClient.clear()`, não `invalidateQueries()`**

`invalidateQueries()` marca queries como stale e dispara refetch, mas ainda serve o dado antigo
enquanto o refetch está em voo — exatamente o comportamento que causava o bug (a tela pinta com
o dado da conta errada por um instante, às vezes visível o suficiente para confundir). `clear()`
apaga o cache imediatamente; cada query remonta como se fosse a primeira vez, sem nenhum dado
da conta anterior para exibir enquanto carrega.

**Por que ignorar a primeira notificação e uids repetidos**

`onAuthStateChanged` dispara pelo menos uma vez no carregamento da aba (não é uma "troca",
não há nada em cache pra limpar ainda) e pode disparar de novo para o mesmo usuário (refresh
de token do Firebase) — limpar o cache nesses casos seria desperdício sem nenhum ganho
(refetch de tudo sem necessidade). Só limpa quando o `uid` observado realmente muda de um valor
para outro (incluindo login→logout e logout→login), rastreado por dois `useRef` (`uid anterior`
e "já vi a primeira notificação").

## What this does not solve

Não resolve a mesma classe de problema para nenhum outro estado global que não seja o
`QueryClient` — se um componente guardar dado da conta anterior em `useState` local sem
depender de uma query (nenhum caso conhecido hoje, mas vale checar ao introduzir um), esse
estado não é afetado por este fix. Não adiciona escopo de conta às próprias query keys (o que
tornaria o cache correto por si só, sem depender de limpar tudo) — optou-se pela solução mais
simples e ampla (`clear()` no ponto único onde a identidade muda) em vez de auditar e escopar
cada query key existente uma a uma.

## References

- [_local-edr-policy-014-authcontext-react](014-auth-context.md) - AuthContext como único listener de onAuthStateChanged, base sobre a qual este fix se apoia
