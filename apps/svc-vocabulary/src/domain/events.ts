import { randomUUID } from 'node:crypto';
import { CardCreatedEvent, Topics } from '@lingua/contracts';
import { Card } from './card.entity';

/** Build the `vocabulary.card.created` domain event for a newly created card. */
export function cardCreatedEvent(card: Card, ownerId: string): CardCreatedEvent {
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
