import { db } from '../firebase-admin.js'
import type { TopicSuggestionRepository, TopicSuggestion } from '@socialshelf/domain'

export class FirestoreTopicSuggestionRepository implements TopicSuggestionRepository {
  async save(suggestion: TopicSuggestion): Promise<void> {
    await db
      .collection('users')
      .doc(suggestion.brandId)
      .collection('brands')
      .doc(suggestion.brandId)
      .collection('topic_suggestions')
      .doc(suggestion.id)
      .set({
        ...suggestion,
        createdAt: suggestion.createdAt.toISOString(),
      })
  }

  async findLatestByBrand(brandId: string): Promise<TopicSuggestion[]> {
    const snapshot = await db
      .collection('users')
      .doc(brandId)
      .collection('brands')
      .doc(brandId)
      .collection('topic_suggestions')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()

    return snapshot.docs.map((doc) => this.fromFirestore(doc.data()))
  }

  private fromFirestore(data: FirebaseFirestore.DocumentData): TopicSuggestion {
    return {
      id: data['id'] as string,
      brandId: data['brandId'] as string,
      headline: data['headline'] as string,
      summary: data['summary'] as string,
      sourceUrl: data['sourceUrl'] as string,
      sourceDomain: data['sourceDomain'] as string,
      rationale: data['rationale'] as string,
      audienceFitScore: data['audienceFitScore'] as number,
      createdAt: new Date(data['createdAt'] as string),
    }
  }
}
