import { Deck } from '../deck.entity';

/** DI token for the {@link DeckRepository} outbound port. */
export const DECK_REPOSITORY = Symbol('DeckRepository');

/** Outbound port: persistence of decks. */
export interface DeckRepository {
  create(deck: Deck): Promise<void>;
  findById(id: string): Promise<Deck | null>;
  findByOwner(ownerId: string): Promise<Deck[]>;
}
