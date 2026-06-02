import {
  Topics,
  CardCreatedEvent,
  ReviewCompletedEvent,
  SpeakingMistakeDetectedEvent,
  CardsFlaggedEvent,
} from './index';

describe('contracts: event topics', () => {
  it('exposes stable topic names', () => {
    expect(Topics.VocabularyCardCreated).toBe('vocabulary.card.created');
    expect(Topics.LearningReviewCompleted).toBe('learning.review.completed');
    expect(Topics.SpeakingMistakeDetected).toBe('speaking.mistake.detected');
    expect(Topics.VocabularyCardsFlagged).toBe('vocabulary.cards.flagged');
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

  it('typechecks a SpeakingMistakeDetectedEvent envelope (generated payload)', () => {
    const evt: SpeakingMistakeDetectedEvent = {
      eventId: '33333333-3333-3333-3333-333333333333',
      type: Topics.SpeakingMistakeDetected,
      occurredAt: '2026-06-09T00:00:00.000Z',
      payload: {
        userId: 'u1',
        sessionId: 's1',
        scenario: 'interview',
        mistakes: [{ term: 'colleague', kind: 'vocabulary', context: 'my colleage is nice' }],
      },
    };
    expect(evt.payload.mistakes[0].kind).toBe('vocabulary');
  });

  it('typechecks a CardsFlaggedEvent envelope (generated payload)', () => {
    const evt: CardsFlaggedEvent = {
      eventId: '44444444-4444-4444-4444-444444444444',
      type: Topics.VocabularyCardsFlagged,
      occurredAt: '2026-06-09T00:00:00.000Z',
      payload: { userId: 'u1', cardIds: ['c1', 'c2'], reason: 'speaking-mistake' },
    };
    expect(evt.payload.cardIds).toHaveLength(2);
  });
});
