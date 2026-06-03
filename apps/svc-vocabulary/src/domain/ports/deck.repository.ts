import { Deck } from '../deck.entity';

export const DECK_REPOSITORY = Symbol('DeckRepository');

export interface DeckRepository {
  create(deck: Deck): Promise<void>;
  findById(id: string): Promise<Deck | null>;
  findByOwner(ownerId: string): Promise<Deck[]>;

  findOrCreateSpeakingDeck(ownerId: string): Promise<Deck>;
}
