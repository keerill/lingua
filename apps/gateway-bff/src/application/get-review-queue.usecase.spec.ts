import type { Card, NextSchedule, ReviewGrade } from '@lingua/contracts';
import { GetReviewQueueUseCase } from './get-review-queue.usecase';
import { DueScheduleRow, LearningPort } from './ports/learning.port';
import { VocabularyPort } from './ports/vocabulary.port';

/** In-memory port doubles — test the aggregation use case with no HTTP. */
const card = (id: string, deckId = 'd1'): Card => ({
  id,
  deckId,
  term: `term-${id}`,
  translation: `tr-${id}`,
  example: null,
  createdAt: '2026-06-09T00:00:00.000Z',
});

class FakeLearning implements LearningPort {
  constructor(private rows: DueScheduleRow[]) {}
  async getQueue() {
    return this.rows;
  }
  submitReview(): Promise<NextSchedule> {
    throw new Error('not used');
  }
  setRows(rows: DueScheduleRow[]) {
    this.rows = rows;
  }
}

class FakeVocabulary implements VocabularyPort {
  constructor(private cards: Card[]) {}
  async getCards(_ownerId: string, ids: string[]) {
    return this.cards.filter((c) => ids.includes(c.id));
  }
  createDeck(): never {
    throw new Error('not used');
  }
  listDecks(): never {
    throw new Error('not used');
  }
  createCard(): never {
    throw new Error('not used');
  }
}

describe('GetReviewQueueUseCase (BFF aggregation)', () => {
  const due = (cardId: string): DueScheduleRow => ({
    cardId,
    due: '2026-06-09T10:00:00.000Z',
    state: 'New',
    reps: 0,
    lapses: 0,
  });

  it('joins due schedules with card details into DueCards', async () => {
    const learning = new FakeLearning([due('c1'), due('c2')]);
    const vocabulary = new FakeVocabulary([card('c1'), card('c2')]);
    const useCase = new GetReviewQueueUseCase(learning, vocabulary);

    const result = await useCase.execute('user-1', 20);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ cardId: 'c1', term: 'term-c1', state: 'New' });
  });

  it('drops due rows whose card no longer exists', async () => {
    const learning = new FakeLearning([due('c1'), due('gone')]);
    const vocabulary = new FakeVocabulary([card('c1')]);
    const useCase = new GetReviewQueueUseCase(learning, vocabulary);

    const result = await useCase.execute('user-1', 20);

    expect(result).toHaveLength(1);
    expect(result[0].cardId).toBe('c1');
  });

  it('returns empty without calling vocabulary when nothing is due', async () => {
    const learning = new FakeLearning([]);
    const vocabulary = new FakeVocabulary([]);
    const getCardsSpy = jest.spyOn(vocabulary, 'getCards');
    const useCase = new GetReviewQueueUseCase(learning, vocabulary);

    const result = await useCase.execute('user-1', 5);

    expect(result).toEqual([]);
    expect(getCardsSpy).not.toHaveBeenCalled();
  });
});
