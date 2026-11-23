// Frase estável usada por todos os AnalyticsReaders quando a falha é de autenticação (token
// expirado, revogado, ou permissão perdida) — o frontend (isPermissionError em
// dashboard/performance/page.tsx) casa por essa frase exata para trocar o erro cru da
// plataforma por um aviso amigável com botão de reconectar. Achado real em produção
// (2026-11-22): a Meta devolvia "Error validating access token: Session has expired..." sem
// nenhuma tradução, e o LinkedIn devolvia o JSON cru de EXPIRED_ACCESS_TOKEN — nenhum dos dois
// batia com o regex antigo do frontend, que só reconhecia jargão específico da Meta.
export const RECONNECT_REQUIRED_MESSAGE =
  'a conexão perdeu a validade ou uma permissão necessária para ler as métricas'
