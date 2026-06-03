import { CardCreatedEvent, CardsFlaggedEvent } from '@lingua/contracts';
import { Card } from '../card.entity';

export const CARD_REPOSITORY = Symbol('CardRepository');

export interface CardRepository {
  createWithEvent(card: Card, event: CardCreatedEvent): Promise<void>;

  findByIds(ownerId: string, ids: string[]): Promise<Card[]>;

  findByDeckAndTerms(deckId: string, terms: string[]): Promise<Card[]>;

  ingestMistakeCards(
    newCards: Card[],
    cardCreatedEvents: CardCreatedEvent[],
    flaggedEvent: CardsFlaggedEvent,
  ): Promise<void>;
}
