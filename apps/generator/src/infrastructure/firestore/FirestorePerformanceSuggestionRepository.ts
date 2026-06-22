import { db } from '../firebase-admin.js'
import type { PerformanceSuggestionRepository, PerformanceSuggestion, PerformanceSuggestionFeedback } from '@socialshelf/domain'

export class FirestorePerformanceSuggestionRepository implements PerformanceSuggestionRepository {
  async save(suggestion: PerformanceSuggestion): Promise<void> {
    await db
      .collection('users')
      .doc(suggestion.brandId)
      .collection('brands')
      .doc(suggestion.brandId)
      .collection('performance_suggestions')
      .doc(suggestion.id)
      .set({
        ...suggestion,
        createdAt: suggestion.createdAt.toISOString(),
      })
  }

  async findLatestByBrand(brandId: string): Promise<PerformanceSuggestion[]> {
    const snapshot = await db
      .collection('users')
      .doc(brandId)
      .collection('brands')
      .doc(brandId)
      .collection('performance_suggestions')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()

    return snapshot.docs.map((doc) => this.fromFirestore(doc.data()))
  }

  async recordFeedback(brandId: string, id: string, feedback: PerformanceSuggestionFeedback): Promise<void> {
    await db
      .collection('users')
      .doc(brandId)
      .collection('brands')
      .doc(brandId)
      .collection('performance_suggestions')
      .doc(id)
      .update({ feedback })
  }

  async setShelved(brandId: string, id: string, shelved: boolean): Promise<void> {
    await db
      .collection('users')
      .doc(brandId)
      .collection('brands')
      .doc(brandId)
      .collection('performance_suggestions')
      .doc(id)
      .update({ shelved })
  }

  async findShelvedByBrand(brandId: string): Promise<PerformanceSuggestion[]> {
    // A single equality filter only needs Firestore's automatic single-field
    // index, unlike where()+orderBy() on different fields, which needs a
    // composite index the deployer SA can't currently create in production
    // (see .github/workflows/deploy.yml — PERMISSION_DENIED, swallowed by
    // `|| true`). Sorting here in memory avoids depending on that index.
    const snapshot = await db
      .collection('users')
      .doc(brandId)
      .collection('brands')
      .doc(brandId)
      .collection('performance_suggestions')
      .where('shelved', '==', true)
      .get()

    return snapshot.docs
      .map((doc) => this.fromFirestore(doc.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  private fromFirestore(data: FirebaseFirestore.DocumentData): PerformanceSuggestion {
    return {
      id: data['id'] as string,
      brandId: data['brandId'] as string,
      headline: data['headline'] as string,
      rationale: data['rationale'] as string,
      viralScore: data['viralScore'] as number,
      basedOnThemes: data['basedOnThemes'] as string[],
      feedback: (data['feedback'] as PerformanceSuggestionFeedback | undefined) ?? null,
      bestTimeToPost: (data['bestTimeToPost'] as string | undefined) ?? '',
      bestTimeWeekdays: (data['bestTimeWeekdays'] as number[] | undefined) ?? [],
      bestTimeHourStart: (data['bestTimeHourStart'] as number | undefined) ?? 0,
      bestTimeHourEnd: (data['bestTimeHourEnd'] as number | undefined) ?? 23,
      shelved: (data['shelved'] as boolean | undefined) ?? false,
      createdAt: new Date(data['createdAt'] as string),
    }
  }
}
