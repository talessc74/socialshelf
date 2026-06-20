---
name: _local-adr-policy-031-template-texto-sobre-imagem
description: Define como o texto (headline) passa a ser desenhado de forma determinística sobre a imagem gerada, via seletor de estilo de template, em vez de depender do Imagen "desenhar" o texto. Use ao implementar ImageGeneratorPort, TemplateRendererPort, GenerateContentUseCase, ou o seletor de estilo no front-end.
apply-to: packages/domain — CopyGeneratorPort, ImageGeneratorPort, TemplateRendererPort; apps/generator — composição de template; apps/web — seletor de estilo em /dashboard/generate
valid-from: 2026-06-20
---

# _local-adr-policy-031: Template de Texto Sobre Imagem (Seletor de Estilo)

## Context and Problem Statement

[_local-adr-policy-028-geracao-de-conteudo-multiartefato](028-geracao-multiartefato.md) decidiu que tokens de marca (cores, tipografia) entram como **instrução textual do prompt ao Imagen**, sem composição programática — e registrou explicitamente que pós-processamento determinístico (overlay de texto/logo) seria "decisão de fase futura".

Uso real em produção (2026-06-20, carrossel de 3 imagens sobre "juridiquês") mostrou a limitação dessa abordagem: o Imagen tenta desenhar texto dentro da imagem quando o prompt menciona palavras como "Habeas Corpus", produzindo texto ilegível/garbled. Um post real de referência do usuário (Instagram) usa texto nítido desenhado sobre a imagem, em um template visual consistente (faixa de texto, tipografia da marca, hierarquia clara) — isso não é alcançável apenas com instrução textual a um modelo de geração de imagem.

Como permitir que o usuário escolha um estilo de template e tenha um headline nítido, legível, na cor/tipografia da marca, desenhado sobre a imagem de fundo gerada por IA?

## Decision Outcome

**O Imagen continua gerando apenas a imagem de fundo (sem instrução de texto a desenhar). Um novo port `TemplateRendererPort`, implementado com `sharp` + SVG no `generator-service`, compõe deterministicamente um headline de texto sobre essa imagem de fundo, segundo um template de estilo escolhido pelo usuário.**

### Details

**Catálogo inicial de estilos** (`TemplateStyle`, 3 opções na Fase 3):

- `bold-bottom` — faixa sólida na cor primária da marca na parte inferior, headline em texto branco/contrastante.
- `centered-overlay` — gradiente escuro sobre a imagem inteira, headline centralizado.
- `top-strip` — faixa na cor secundária da marca no topo, headline em destaque.

Catálogo é uma lista fechada e pequena nesta fase — não é um editor de template livre. Evolução do catálogo (mais estilos, customização livre) é decisão de fase futura.

**Headline como novo campo de `CopyGeneratorPort`**

`CopyGenerationResult` ganha `headlines: string[]` (curto, ~80 caracteres cada, compartilhado entre plataformas) — distinto das `copies` por plataforma (que são a legenda completa). O Gemini gera os headlines junto com a copy, na mesma chamada. `GenerationRequest.outputs` passa a incluir `headlines: string[] | null` ao lado de `copies`/`cta`.

**Correção — um headline por slide, formando narrativa, não um headline repetido (2026-06-20)**

A primeira versão deste ADR previa um único `headline: string` reaproveitado em todos os artefatos de um carrossel. Em uso real, isso produziu carrosséis onde cada slide tinha imagem de fundo diferente mas o **mesmo texto repetido** em todos os cards — não é isso que um carrossel real faz (cada card avança uma narrativa: gancho → desenvolvimento → fechamento). Corrigido: `ContentInputs` ganha `artifactCount: number`; `CopyGeneratorPort.generateCopy()` retorna `headlines: string[]` com exatamente `artifactCount` itens, um por posição de slide; `GeminiCopyGenerator` instrui explicitamente o Gemini a gerar uma sequência narrativa quando `artifactCount > 1` (primeiro slide = gancho/problema, slides do meio = desenvolvimento, último = conclusão/CTA), e valida que o array retornado tem o tamanho exato esperado, falhando a geração de copy (não a de imagem) se o modelo devolver um número diferente. `GenerateContentUseCase` usa `headlines[artifact.position - 1]` ao renderizar o template de cada artefato.

**Fluxo de geração**

1. `GenerateContentUseCase` chama `CopyGeneratorPort.generateCopy()` → obtém `copies`, `cta`, `headline`.
2. Para cada artefato, chama `ImageGeneratorPort.generateImage()` (Imagen, sem instrução de texto) → imagem de fundo.
3. Chama `TemplateRendererPort.render({ backgroundImage, headline, style, brandTokens })` → imagem final com texto composto.
4. Só a imagem final (já com o texto) é enviada a `ImageStoragePort.upload()` — o storage não passa a conhecer "fundo" vs "composta": o contrato de `GenerationArtifact.imageStoragePath` não muda.

**Por que `sharp` + SVG, e não Puppeteer/Satori**

`sharp` já é dependência do `generator-service` (processamento de imagem), e o runtime Alpine já instala `vips`, que renderiza SVG via `librsvg` sem precisar de um navegador headless — menor superfície de runtime e menor tempo de cold start no Cloud Run do que Puppeteer. O texto é desenhado via elemento SVG `<text>` com fonte do sistema (requer pacote de fontes adicionado à imagem Docker do `generator-service`); não há suporte a fontes customizadas arbitrárias nesta fase — `typography` da marca mapeia para um conjunto fechado de pesos/famílias disponíveis no container (ex: `sans-serif bold` vs `serif`), não para upload de arquivo de fonte.

**Seletor de estilo no front-end**

`/dashboard/generate` ganha um campo de seleção de estilo no `FormView` (grid de 3 prévias, uma por `TemplateStyle`), enviado como `style` no corpo de `POST /generate`. Estilo é input transitório da geração (como `artifactCount`), não um atributo versionado do `BrandProfile` — o usuário escolhe por geração, podendo variar entre posts.

## References

- [_local-adr-policy-028-geracao-de-conteudo-multiartefato](028-geracao-multiartefato.md) - Decisão anterior (texto só por instrução), superada nesta parte por este ADR
- [_local-adr-policy-025-brandprofile-schema-versionamento](025-brand-profile-schema-versionamento.md) - Onde moram `primaryColor`/`secondaryColor`/`typography`
- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../../bdrs/product/plans/002-roadmap-equipe-marketing-autonoma.md) - Fase 3, Criação Multiformato
