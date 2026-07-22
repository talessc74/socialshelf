# _local ADRs Index

Decisões arquiteturais e técnicas do SocialShelf, criadas via deliberação ARGUS.

## Subjects

### principles
Fundamentos transversais de engenharia.

- [_local-adr-policy-001-principios-de-engenharia](principles/001-engineering-principles.md) - Cinco princípios de engenharia vinculantes: Evolutionary Design, Responsabilidade, Legibilidade, TDD e Inversão de Dependência

### application
Decisões de design de sistema e decomposição de serviços.

- [_local-adr-policy-002-arquitetura-hexagonal](application/002-hexagonal-architecture.md) - Domain layer puro com ports e adapters: como isolar lógica de negócio de infraestrutura
- [_local-adr-policy-003-monorepo-pnpm-turborepo](application/003-monorepo-pnpm-turbo.md) - pnpm workspaces + Turborepo como estrutura de monorepo e orquestração de builds
- [_local-adr-policy-004-decomposicao-de-servicos](application/004-service-decomposition.md) - Quatro serviços independentes (api, publisher, generator, web) com responsabilidades mutuamente exclusivas
- [_local-adr-policy-018-post-maquina-de-estados-de-publicacao](application/018-post-state-machine.md) - Cinco estados do ciclo de vida de um Post: draft, ai-draft, scheduled, published, failed
- [_local-adr-policy-019-geracao-de-conteudo-maquina-de-estados](application/019-generation-state-machine.md) - Estados de GenerationRequest para geração assíncrona de conteúdo via IA
- [_local-adr-policy-025-brandprofile-schema-e-versionamento](application/025-brand-profile-schema-versionamento.md) - Schema de 6 seções do BrandProfile e versionamento imutável como base do contexto de marca
- [_local-adr-policy-027-pauta-localizacao-e-verificacao-factual](application/027-pauta-localizacao-e-verificacao-factual.md) - Motor de pauta vive em generator; notícia só é verificada se a fonte resolve para domínio confiável cadastrado
- [_local-adr-policy-028-geracao-de-conteudo-multiartefato](application/028-geracao-multiartefato.md) - GenerationRequest.outputs.artifacts substitui imagem única; post único e carrossel são o mesmo agregado (N≥1)
- [_local-adr-policy-031-template-de-texto-sobre-imagem](application/031-template-texto-sobre-imagem.md) - Headline desenhado deterministicamente via sharp+SVG sobre a imagem de fundo do Imagen, por catálogo fechado de estilo
- [_local-adr-policy-030-quota-de-marca-por-tipo-de-conta](application/030-quota-marca-tipo-conta.md) - accountType em Brand, checagem de quota contra Subscription antes de criar marca, sinal específico de limite de plano; imutabilidade temporariamente relaxada via switch no site (sem billing real ainda)
- [_local-adr-policy-036-geracao-de-video-assincrona](application/036-geracao-video-multiartefato-assincrona.md) - GenerationArtifact ganha mediaType image/video; vídeo roda em job assíncrono, nunca no request/response síncrono
- [_local-adr-policy-037-audio-sincronizacao-biblioteca-musica](application/037-audio-sincronizacao-biblioteca-musica.md) - Narração dita duração do vídeo; música se ajusta ao vídeo com fade-out; biblioteca de música própria e catálogo fechado
- [_local-adr-policy-040-ativacao-do-modo-automatico-de-publicacao](application/040-ativacao-modo-automatico-publicacao.md) - Ativa o dial de autonomia (Fase 4) com guardrails como pré-condição: teto diário definido pelo usuário, classificação semântica de bloqueio, e modo automático restrito aos tópicos liberados
- [_local-adr-policy-041-campanha-de-fotos-espinha-dorsal-fase-1](application/041-campanha-de-fotos-espinha-dorsal.md) - Fase 1 da campanha de fotos em lote: usuário sobe suas fotos, sistema agrupa por localidade/EXIF e materializa Post normais via o mesmo agendador que já existe

### controls
Controles de segurança e proteção de dados em nível arquitetural.

- [_local-adr-policy-005-zero-trust-baseline](controls/005-zero-trust-baseline.md) - Negação implícita em todas as camadas: Firestore, Cloud Run e comunicação entre serviços
- [_local-adr-policy-006-dados-como-passivo-minimizacao](controls/006-data-minimization.md) - Dados como passivo: critério de coleta e política por dimensão de dado
- [_local-adr-policy-007-identidade-pairwise-e-consentimento](controls/007-pairwise-identity-consent.md) - Identidades pairwise por plataforma e consentimento explícito como pré-requisito
- [_local-adr-policy-012-token-vault-criptografia-aes-256-gcm](controls/012-token-vault-encryption.md) - Criptografia AES-256-GCM de tokens OAuth no Firestore com derivação de chave via SHA-256
- [_local-adr-policy-014-state-oauth-hmac-sha256-com-expiracao](controls/014-state-oauth-hmac-sha256.md) - State parameter OAuth com HMAC-SHA256, nonce, timestamp e expiração de 10 minutos
- [_local-adr-policy-015-firestore-security-rules-implicit-deny](controls/015-firestore-security-rules.md) - Implicit deny como regra catch-all e acesso baseado em propriedade (isOwner)
- [_local-adr-policy-026-sinal-de-audiencia-minimizacao-e-leitura](controls/026-sinal-audiencia-minimizacao.md) - Apenas sinal agregado de audiência é retido; leitura de analytics vive em publisher junto aos tokens OAuth

### data
Arquitetura e retenção de dados.

- [_local-adr-policy-008-retencao-e-privacidade-de-dados](data/008-data-retention-privacy.md) - Política de retenção por tipo de dado e regras de deleção ativa
- [_local-adr-policy-017-separacao-pairwiseid-e-tokenref-oauth](data/017-separacao-pairwiseid-tokenref-oauth.md) - PairwiseId (identidade) e TokenRef (vault) como campos com propósitos distintos em OAuthConnection

### integration
Integração com sistemas externos.

- [_local-adr-policy-009-oauth-exclusivo-integracao-com-redes-sociais](integration/009-oauth-social-networks.md) - OAuth exclusivo com redes sociais: sem credenciais, escopo mínimo, tokens por marca
- [_local-adr-policy-013-pkce-por-plataforma-oauth-seletivo](integration/013-pkce-por-plataforma.md) - PKCE (RFC 7636) obrigatório para X, não aplicável para LinkedIn e Meta
- [_local-adr-policy-016-refresh-de-token-oauth-por-plataforma](integration/016-refresh-token-oauth.md) - X com refresh automático; LinkedIn e Meta dependem de tokens de longa duração
- [_local-adr-policy-024-instagram-publicacao-em-duas-etapas](integration/024-instagram-publicacao-duas-etapas.md) - Fluxo obrigatório de duas chamadas da Meta Graph API para publicar no Instagram
- [_local-adr-policy-032-monitoramento-de-versao-da-api-do-linkedin](integration/032-monitoramento-versao-api-linkedin.md) - Revisão trimestral da constante LI_VERSION com data de sunset documentada inline, prevenindo falha 426 NONEXISTENT_VERSION silenciosa
- [_local-adr-policy-034-tiktok-oauth-e-identificadores-pairwise](integration/034-tiktok-oauth-identificadores.md) - pairwiseId = open_id exclusivamente; union_id descartado no callback; refresh automático (24h/1 ano)
- [_local-adr-policy-035-tiktok-publicacao-em-multiplas-etapas](integration/035-tiktok-publicacao-multi-chunk.md) - PULL_FROM_URL como estratégia de envio de vídeo ao TikTok, sem chunking client-side
- [_local-adr-policy-038-selecao-de-pagina-conexao-multi-marca](integration/038-selecao-pagina-conexao-multi-marca.md) - Seleção explícita de página/organização para LinkedIn e Meta quando há múltiplas; aviso de troca de sessão para X

### platform
Infraestrutura de plataforma e serviços GCP.

- [_local-adr-policy-010-gcp-infrastructure-baseline](platform/010-gcp-infrastructure.md) - GCP como plataforma: Cloud Run, Firestore, Vertex AI, Secret Manager e IAM por serviço
- [_local-adr-policy-020-firestore-hierarquia-de-sub-documentos](platform/020-firestore-schema.md) - Hierarquia de coleções Firestore por propriedade: users > brands > posts/connections
- [_local-adr-policy-021-firestore-indices-compostos-por-query](platform/021-firestore-indexes.md) - Oito índices compostos declarados antes das queries — estratégia query-first
- [_local-adr-policy-022-cloud-run-configuracao-por-servico](platform/022-cloud-run-config.md) - Configuração diferenciada de memória, timeout e acesso por serviço no Cloud Run
- [_local-adr-policy-023-iam-papeis-por-servico](platform/023-iam-policies.md) - Papéis IAM mínimos por service account: princípio do mínimo privilégio por serviço
- [_local-adr-policy-033-cloud-scheduler-wake-up-do-publisher](platform/033-cloud-scheduler-scale-to-zero.md) - Cloud Scheduler acorda o publisher-service a cada minuto via HTTP para garantir publicação agendada com min-instances=0
- [_local-adr-policy-039-dominio-radiokactus-com-dns-e-roteamento](platform/039-dominio-radiokactus-dns-roteamento.md) - Estado real do DNS de radiokactus.com: registrador Hostgator, raiz respondida pelo Google (Cloud Run), entrada Vercel legada não removida
- [_local-adr-policy-042-google-sign-in-identity-services](platform/042-google-sign-in-identity-services.md) - Login com Google via Google Identity Services + signInWithCredential, substituindo signInWithRedirect do Firebase Auth (iframe cross-origin bloqueado no Safari)

### operations
Decisões operacionais e de resposta a incidentes.

- [_local-adr-policy-011-transparencia-em-incidentes](operations/011-incident-transparency.md) - Protocolo de comunicação imediata e transparente em incidentes de segurança
