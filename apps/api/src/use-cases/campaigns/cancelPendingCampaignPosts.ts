import type { CampaignItem, CampaignItemRepository, PostRepository } from '@socialshelf/domain'

// Compartilhado por PauseCampaignUseCase e CancelCampaignUseCase: os dois precisam desfazer a
// materialização de itens que viraram Post real mas ainda não publicaram. Só existe uma coisa
// que de fato impede o publisher de publicar — o Post sair do status 'scheduled' — porque
// ScheduledPostsPoller escaneia todos os Posts agendados sem olhar pra campanha nenhuma
// (findScheduledBefore). Apagar o Post e devolver o item pra 'planned' (postId null) é o que
// garante isso; um Post já 'publishing', 'published' ou 'failed' fica intocado, preservado como
// histórico.
export async function cancelPendingCampaignPosts(
  items: CampaignItem[],
  itemRepo: CampaignItemRepository,
  postRepo: PostRepository,
): Promise<void> {
  const materialized = items.filter((item): item is CampaignItem & { postId: string } => item.status === 'materialized' && item.postId !== null)

  const reverted: CampaignItem[] = []
  for (const item of materialized) {
    // findByIdAndBrand lê o doc direto pelo caminho (users/brands/posts) — findById faz uma
    // collectionGroup('posts').where('id', '==', ...) que exige um índice composto que não
    // existe em produção (achado real: 9 FAILED_PRECONDITION ao cancelar/pausar uma campanha).
    const post = await postRepo.findByIdAndBrand(item.postId, item.userId, item.brandId)
    if (!post || post.status !== 'scheduled') continue
    await postRepo.delete(post.id, post.userId, post.brandId)
    reverted.push({ ...item, status: 'planned', postId: null })
  }

  if (reverted.length > 0) await itemRepo.saveAll(reverted)
}
