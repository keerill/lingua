import {
  CardCreatedEvent,
  CardsFlaggedEvent,
  SpeakingMistakeDetectedPayload,
} from '@lingua/contracts';
import { Deck } from '../domain/deck.entity';
import { Card } from '../domain/card.entity';
import { DeckRepository } from '../domain/ports/deck.repository';
import { CardRepository } from '../domain/ports/card.repository';
import { IngestSpeakingMistakesUseCase } from './ingest-speaking-mistakes.usecase';

class InMemoryDeckRepository implements DeckRepository {
  decks: Deck[] = [];
  async create(d: Deck) {
    this.decks.push(d);
  }
  async findById(id: string) {
    return this.decks.find((d) => d.id === id) ?? null;
  }
  async findByOwner(ownerId: string) {
    return this.decks.filter((d) => d.ownerId === ownerId);
  }
  async findOrCreateSpeakingDeck(ownerId: string) {
    let deck = this.decks.find(
      (d) => d.ownerId === ownerId && d.source === 'speaking',
    );
    if (!deck) {
      deck = new Deck(
        `deck-${ownerId}`,
        ownerId,
        'Speaking practice',
        'en',
        'ru',
        new Date(),
        'speaking',
      );
      this.decks.push(deck);
    }
    return deck;
  }
}

class InMemoryCardRepository implements CardRepository {
  cards: Card[] = [];
  cardCreated: CardCreatedEvent[] = [];
  flagged: CardsFlaggedEvent[] = [];
  async createWithEvent() {}
  async findByIds() {
    return [];
  }
  async findByDeckAndTerms(deckId: string, terms: string[]) {
    return this.cards.filter(
      (c) => c.deckId === deckId && terms.includes(c.term),
    );
  }
  async ingestMistakeCards(
    newCards: Card[],
    cardCreatedEvents: CardCreatedEvent[],
    flaggedEvent: CardsFlaggedEvent,
  ) {
    this.cards.push(...newCards);
    this.cardCreated.push(...cardCreatedEvents);
    this.flagged.push(flaggedEvent);
  }
}

const payload = (
  mistakes: SpeakingMistakeDetectedPayload['mistakes'],
): SpeakingMistakeDetectedPayload => ({
  userId: 'u1',
  sessionId: 's1',
  scenario: 'interview',
  mistakes,
});

describe('IngestSpeakingMistakesUseCase', () => {
  let decks: InMemoryDeckRepository;
  let cards: InMemoryCardRepository;
  let useCase: IngestSpeakingMistakesUseCase;

  beforeEach(() => {
    decks = new InMemoryDeckRepository();
    cards = new InMemoryCardRepository();
    useCase = new IngestSpeakingMistakesUseCase(decks, cards);
  });

  it('creates the speaking deck, seeds new cards, and flags all of them', async () => {
    await useCase.execute(
      payload([
        {
          term: 'went',
          kind: 'grammar',
          context: 'yesterday I go',
          translation: 'past of go',
        },
        { term: 'flight', kind: 'vocabulary', context: 'I miss my fly' },
      ]),
    );

    expect(decks.decks.some((d) => d.source === 'speaking')).toBe(true);
    expect(cards.cards.map((c) => c.term).sort()).toEqual(['flight', 'went']);
    expect(cards.cardCreated).toHaveLength(2);
    expect(cards.flagged).toHaveLength(1);
    expect(cards.flagged[0].type).toBe('vocabulary.cards.flagged');
    expect(cards.flagged[0].payload.cardIds).toHaveLength(2);
    expect(cards.flagged[0].payload.reason).toBe('speaking-mistake');
  });

  it('is idempotent: a pre-existing term is not duplicated but is still flagged', async () => {
    const deck = await decks.findOrCreateSpeakingDeck('u1');
    cards.cards.push(
      Card.create(deck.id, {
        term: 'went',
        translation: 'past of go',
        example: 'x',
      }),
    );

    await useCase.execute(
      payload([{ term: 'went', kind: 'grammar', context: 'yesterday I go' }]),
    );

    expect(cards.cards.filter((c) => c.term === 'went')).toHaveLength(1);
    expect(cards.cardCreated).toHaveLength(0);
    expect(cards.flagged[0].payload.cardIds).toHaveLength(1);
  });

  it('does nothing when there are no mistakes', async () => {
    await useCase.execute(payload([]));
    expect(cards.flagged).toHaveLength(0);
    expect(cards.cards).toHaveLength(0);
  });
});
