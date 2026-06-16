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

### controls
Controles de segurança e proteção de dados em nível arquitetural.

- [_local-adr-policy-005-zero-trust-baseline](controls/005-zero-trust-baseline.md) - Negação implícita em todas as camadas: Firestore, Cloud Run e comunicação entre serviços
- [_local-adr-policy-006-dados-como-passivo-minimizacao](controls/006-data-minimization.md) - Dados como passivo: critério de coleta e política por dimensão de dado
- [_local-adr-policy-007-identidade-pairwise-e-consentimento](controls/007-pairwise-identity-consent.md) - Identidades pairwise por plataforma e consentimento explícito como pré-requisito
- [_local-adr-policy-012-token-vault-criptografia-aes-256-gcm](controls/012-token-vault-encryption.md) - Criptografia AES-256-GCM de tokens OAuth no Firestore com derivação de chave via SHA-256
- [_local-adr-policy-014-state-oauth-hmac-sha256-com-expiracao](controls/014-state-oauth-hmac-sha256.md) - State parameter OAuth com HMAC-SHA256, nonce, timestamp e expiração de 10 minutos
- [_local-adr-policy-015-firestore-security-rules-implicit-deny](controls/015-firestore-security-rules.md) - Implicit deny como regra catch-all e acesso baseado em propriedade (isOwner)

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

### platform
Infraestrutura de plataforma e serviços GCP.

- [_local-adr-policy-010-gcp-infrastructure-baseline](platform/010-gcp-infrastructure.md) - GCP como plataforma: Cloud Run, Firestore, Vertex AI, Secret Manager e IAM por serviço
- [_local-adr-policy-020-firestore-hierarquia-de-sub-documentos](platform/020-firestore-schema.md) - Hierarquia de coleções Firestore por propriedade: users > brands > posts/connections
- [_local-adr-policy-021-firestore-indices-compostos-por-query](platform/021-firestore-indexes.md) - Oito índices compostos declarados antes das queries — estratégia query-first
- [_local-adr-policy-022-cloud-run-configuracao-por-servico](platform/022-cloud-run-config.md) - Configuração diferenciada de memória, timeout e acesso por serviço no Cloud Run
- [_local-adr-policy-023-iam-papeis-por-servico](platform/023-iam-policies.md) - Papéis IAM mínimos por service account: princípio do mínimo privilégio por serviço

### operations
Decisões operacionais e de resposta a incidentes.

- [_local-adr-policy-011-transparencia-em-incidentes](operations/011-incident-transparency.md) - Protocolo de comunicação imediata e transparente em incidentes de segurança
