// Prazos de retenção de imagem em Cloud Storage — protegem contra crescimento ilimitado do
// bucket e são a mesma janela já usada para vídeo bruto de usuário (_local-edr-policy-034) e
// para "Uploads do usuário" em _local-adr-policy-008, agora estendida a fotos de post publicado
// e fotos de campanha cancelada (_local-edr-policy-067). Exportado aqui pra apps/api (que roda a
// limpeza) e apps/web (que precisa mostrar o mesmo prazo ao usuário) nunca divergirem.
export const PUBLISHED_POST_IMAGE_RETENTION_DAYS = 7
export const CANCELLED_CAMPAIGN_PHOTO_RETENTION_DAYS = 7
