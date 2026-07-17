import { randomUUID } from 'crypto'
import { Platform, derivePairwiseId } from '@socialshelf/domain'
import type { OAuthConnection, OAuthRepository, TokenVaultPort } from '@socialshelf/domain'
import type { MetaPage } from '../../lib/meta-client.js'

export interface MetaConnectionResult {
  facebook: OAuthConnection
  instagram: OAuthConnection | null
}

// Persiste a conexão Facebook (sempre) e Instagram (só se essa Página tiver uma conta Business
// vinculada) para UMA Página já escolhida — pelo próprio usuário (ConfirmMetaPageSelectionUseCase,
// quando ele administra mais de uma) ou automaticamente (HandleMetaCallbackUseCase, quando só
// existe uma). accountLabel grava o nome da Página / @ do Instagram pra Central de Contas mostrar
// qual conta é essa de verdade, em vez de só "Conectado" (_local-edr-policy-053).
export async function persistMetaPageConnection(
  oauthRepo: OAuthRepository,
  tokenVault: TokenVaultPort,
  userId: string,
  brandId: string,
  userAccessToken: string,
  expiresAt: Date,
  page: MetaPage,
): Promise<MetaConnectionResult> {
  const fbPairwiseId = derivePairwiseId(userId, Platform.FACEBOOK)
  const fbTokenRef = `oauth-token-${fbPairwiseId}`

  await tokenVault.store(
    fbTokenRef,
    JSON.stringify({
      user_access_token: userAccessToken,
      page_access_token: page.access_token,
      page_id: page.id,
      page_name: page.name,
      expires_at: expiresAt.toISOString(),
    }),
  )

  const facebook: OAuthConnection = {
    id: randomUUID(),
    userId,
    brandId,
    platform: Platform.FACEBOOK,
    pairwiseId: fbPairwiseId,
    tokenRef: fbTokenRef,
    scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
    accountLabel: page.name,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await oauthRepo.save(facebook)

  let instagram: OAuthConnection | null = null
  if (page.instagram_business_account) {
    const igPairwiseId = derivePairwiseId(userId, Platform.INSTAGRAM)
    const igTokenRef = `oauth-token-${igPairwiseId}`

    await tokenVault.store(
      igTokenRef,
      JSON.stringify({
        user_access_token: userAccessToken,
        page_access_token: page.access_token,
        instagram_business_account_id: page.instagram_business_account.id,
        page_id: page.id,
        expires_at: expiresAt.toISOString(),
      }),
    )

    instagram = {
      id: randomUUID(),
      userId,
      brandId,
      platform: Platform.INSTAGRAM,
      pairwiseId: igPairwiseId,
      tokenRef: igTokenRef,
      scopes: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_insights'],
      accountLabel: page.instagram_business_account.username ? `@${page.instagram_business_account.username}` : null,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await oauthRepo.save(instagram)
  }

  return { facebook, instagram }
}
