import { Topics, CardCreatedEvent, ReviewCompletedEvent } from './index';

describe('contracts: event topics', () => {
  it('exposes stable topic names', () => {
    expect(Topics.VocabularyCardCreated).toBe('vocabulary.card.created');
    expect(Topics.LearningReviewCompleted).toBe('learning.review.completed');
  });

  it('typechecks a CardCreatedEvent envelope', () => {
    const evt: CardCreatedEvent = {
      eventId: '11111111-1111-1111-1111-111111111111',
      type: Topics.VocabularyCardCreated,
      occurredAt: '2026-06-09T00:00:00.000Z',
      payload: { cardId: 'c1', deckId: 'd1', ownerId: 'u1', term: 'hello' },
    };
    expect(evt.payload.term).toBe('hello');
  });

  it('typechecks a ReviewCompletedEvent envelope', () => {
    const evt: ReviewCompletedEvent = {
      eventId: '22222222-2222-2222-2222-222222222222',
      type: Topics.LearningReviewCompleted,
      occurredAt: '2026-06-09T00:00:00.000Z',
      payload: { userId: 'u1', cardId: 'c1', grade: 3, reviewedAt: '2026-06-09T00:00:00.000Z' },
    };
    expect(evt.payload.grade).toBe(3);
  });
});
