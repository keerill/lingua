import { Inject, Injectable } from '@nestjs/common';
import { DueCard } from '@lingua/contracts';
import { LEARNING_PORT, LearningPort } from './ports/learning.port';
import { VOCABULARY_PORT, VocabularyPort } from './ports/vocabulary.port';

/**
 * The BFF's aggregation use case: fetch due schedules from svc-learning and
 * enrich them with card details from svc-vocabulary into {@link DueCard}s.
 * Drops any due row whose card no longer exists.
 */
@Injectable()
export class GetReviewQueueUseCase {
  constructor(
    @Inject(LEARNING_PORT) private readonly learning: LearningPort,
    @Inject(VOCABULARY_PORT) private readonly vocabulary: VocabularyPort,
  ) {}

  async execute(userId: string, limit: number): Promise<DueCard[]> {
    const due = await this.learning.getQueue(userId, limit);
    if (due.length === 0) return [];

    const cards = await this.vocabulary.getCards(
      userId,
      due.map((d) => d.cardId),
    );
    const byId = new Map(cards.map((c) => [c.id, c]));

    return due
      .map((d): DueCard | null => {
        const card = byId.get(d.cardId);
        if (!card) return null;
        return {
          cardId: d.cardId,
          deckId: card.deckId,
          term: card.term,
          translation: card.translation,
          example: card.example,
          due: d.due,
          state: d.state as DueCard['state'],
          reps: d.reps,
          lapses: d.lapses,
        };
      })
      .filter((c): c is DueCard => c !== null);
  }
}
