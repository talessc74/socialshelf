# _local ADRs Index

Decisões arquiteturais e técnicas do SocialShelf, criadas via deliberação ARGUS.

## Subjects

### principles
Fundamentos transversais de engenharia.

- [_local-adr-policy-001-engineering-principles](principles/001-engineering-principles.md) - Cinco princípios de engenharia vinculantes: Evolutionary Design, Responsabilidade, Legibilidade, TDD e Inversão de Dependência

### application
Decisões de design de sistema e decomposição de serviços.

- [_local-adr-policy-001-hexagonal-architecture](application/001-hexagonal-architecture.md) - Domain layer puro com ports e adapters: como isolar lógica de negócio de infraestrutura
- [_local-adr-policy-002-monorepo-pnpm-turbo](application/002-monorepo-pnpm-turbo.md) - pnpm workspaces + Turborepo como estrutura de monorepo e orquestração de builds
- [_local-adr-policy-003-service-decomposition](application/003-service-decomposition.md) - Quatro serviços independentes (api, publisher, generator, web) com responsabilidades mutuamente exclusivas

### controls
Controles de segurança e proteção de dados em nível arquitetural.

- [_local-adr-policy-001-zero-trust-baseline](controls/001-zero-trust-baseline.md) - Negação implícita em todas as camadas: Firestore, Cloud Run e comunicação entre serviços
- [_local-adr-policy-002-data-minimization](controls/002-data-minimization.md) - Dados como passivo: critério de coleta e política por dimensão de dado
- [_local-adr-policy-003-pairwise-identity-consent](controls/003-pairwise-identity-consent.md) - Identidades pairwise por plataforma e consentimento explícito como pré-requisito

### data
Arquitetura e retenção de dados.

- [_local-adr-policy-001-data-retention-privacy](data/001-data-retention-privacy.md) - Política de retenção por tipo de dado e regras de deleção ativa

### integration
Integração com sistemas externos.

- [_local-adr-policy-001-oauth-social-networks](integration/001-oauth-social-networks.md) - OAuth exclusivo com redes sociais: sem credenciais, escopo mínimo, tokens por marca

### platform
Infraestrutura de plataforma e serviços GCP.

- [_local-adr-policy-001-gcp-infrastructure](platform/001-gcp-infrastructure.md) - GCP como plataforma: Cloud Run, Firestore, Vertex AI, Secret Manager e IAM por serviço

### operations
Decisões operacionais e de resposta a incidentes.

- [_local-adr-policy-001-incident-transparency](operations/001-incident-transparency.md) - Protocolo de comunicação imediata e transparente em incidentes de segurança
