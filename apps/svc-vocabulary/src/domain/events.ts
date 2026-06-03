import { randomUUID } from 'node:crypto';
import { CardCreatedEvent, CardsFlaggedEvent, Topics } from '@lingua/contracts';
import { Card } from './card.entity';

export function cardCreatedEvent(
  card: Card,
  ownerId: string,
): CardCreatedEvent {
  return {
    eventId: randomUUID(),
    type: Topics.VocabularyCardCreated,
    occurredAt: card.createdAt.toISOString(),
    payload: {
      cardId: card.id,
      deckId: card.deckId,
      ownerId,
      term: card.term,
    },
  };
}

export function cardsFlaggedEvent(
  userId: string,
  cardIds: string[],
): CardsFlaggedEvent {
  return {
    eventId: randomUUID(),
    type: Topics.VocabularyCardsFlagged,
    occurredAt: new Date().toISOString(),
    payload: { userId, cardIds, reason: 'speaking-mistake' },
  };
}
