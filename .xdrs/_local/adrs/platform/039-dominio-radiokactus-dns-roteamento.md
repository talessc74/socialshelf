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

## References

- [_local-adr-policy-010-gcp-infrastructure-baseline](010-gcp-infrastructure.md) - Cloud Run como runtime do `web-service` que hoje responde por este domínio
- [_local-edr-policy-011-cors-policy](../../edrs/application/011-cors-policy.md) - `WEB_URL=https://radiokactus.com` como origem de CORS
- [_local-bdr-policy-010-paleta-do-logo-nova-identidade-visual](../../bdrs/product/010-paleta-logo-identidade-visual.md) - Migração planejada para domínio próprio `socialshelf.com.br`
