import { CardCreatedEvent } from '@lingua/contracts';
import { Card } from '../card.entity';

/** DI token for the {@link CardRepository} outbound port. */
export const CARD_REPOSITORY = Symbol('CardRepository');

/** Outbound port: persistence of cards (incl. the transactional outbox write). */
export interface CardRepository {
  /** Persist the card AND its `card.created` outbox event in ONE transaction. */
  createWithEvent(card: Card, event: CardCreatedEvent): Promise<void>;
  /** Fetch the owner's cards by id (used to enrich the BFF review queue). */
  findByIds(ownerId: string, ids: string[]): Promise<Card[]>;
}
