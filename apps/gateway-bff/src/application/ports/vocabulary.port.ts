import { Card, CreateCardDto, CreateDeckDto, Deck } from '@lingua/contracts';

/** DI token for the {@link VocabularyPort} (downstream svc-vocabulary). */
export const VOCABULARY_PORT = Symbol('VocabularyPort');

/** Outbound port: the BFF's view of svc-vocabulary. */
export interface VocabularyPort {
  createDeck(ownerId: string, dto: CreateDeckDto): Promise<Deck>;
  listDecks(ownerId: string): Promise<Deck[]>;
  createCard(ownerId: string, deckId: string, dto: CreateCardDto): Promise<Card>;
  getCards(ownerId: string, cardIds: string[]): Promise<Card[]>;
}
