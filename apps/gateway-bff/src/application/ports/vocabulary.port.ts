import { Card, CreateCardDto, CreateDeckDto, Deck } from '@lingua/contracts';

export const VOCABULARY_PORT = Symbol('VocabularyPort');

export interface VocabularyPort {
  createDeck(ownerId: string, dto: CreateDeckDto): Promise<Deck>;
  listDecks(ownerId: string): Promise<Deck[]>;
  createCard(
    ownerId: string,
    deckId: string,
    dto: CreateCardDto,
  ): Promise<Card>;
  getCards(ownerId: string, cardIds: string[]): Promise<Card[]>;
}
