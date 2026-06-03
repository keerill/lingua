import { Inject, Injectable, Logger } from '@nestjs/common';
import { SpeakingMistakeDetectedPayload } from '@lingua/contracts';
import { Card } from '../domain/card.entity';
import { cardCreatedEvent, cardsFlaggedEvent } from '../domain/events';
import {
  DECK_REPOSITORY,
  DeckRepository,
} from '../domain/ports/deck.repository';
import {
  CARD_REPOSITORY,
  CardRepository,
} from '../domain/ports/card.repository';

@Injectable()
export class IngestSpeakingMistakesUseCase {
  private readonly logger = new Logger(IngestSpeakingMistakesUseCase.name);

  constructor(
    @Inject(DECK_REPOSITORY) private readonly decks: DeckRepository,
    @Inject(CARD_REPOSITORY) private readonly cards: CardRepository,
  ) {}

  async execute(payload: SpeakingMistakeDetectedPayload): Promise<void> {
    const { userId, mistakes } = payload;
    if (!mistakes || mistakes.length === 0) return;

    const deck = await this.decks.findOrCreateSpeakingDeck(userId);

    const terms = [...new Set(mistakes.map((m) => m.term))];
    const existing = await this.cards.findByDeckAndTerms(deck.id, terms);
    const existingTerms = new Set(existing.map((c) => c.term));

    const newCards: Card[] = [];
    const cardCreatedEvents = [];
    for (const term of terms) {
      if (existingTerms.has(term)) continue;
      const mistake = mistakes.find((m) => m.term === term)!;
      const card = Card.create(deck.id, {
        term,
        translation: mistake.translation ?? term,
        example: mistake.context,
      });
      newCards.push(card);
      cardCreatedEvents.push(cardCreatedEvent(card, userId));
    }

    const cardIds = [
      ...existing.map((c) => c.id),
      ...newCards.map((c) => c.id),
    ];
    const flagged = cardsFlaggedEvent(userId, cardIds);

    await this.cards.ingestMistakeCards(newCards, cardCreatedEvents, flagged);
    this.logger.log(
      `seeded ${newCards.length} new card(s), flagged ${cardIds.length} for user=${userId}`,
    );
  }
}
