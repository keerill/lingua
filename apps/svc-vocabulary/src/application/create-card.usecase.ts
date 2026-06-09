import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Card as CardDto, CreateCardDto } from '@lingua/contracts';
import { Card } from '../domain/card.entity';
import { cardCreatedEvent } from '../domain/events';
import { DECK_REPOSITORY, DeckRepository } from '../domain/ports/deck.repository';
import { CARD_REPOSITORY, CardRepository } from '../domain/ports/card.repository';
import { toCardDto } from './mappers';

/**
 * Use case: add a card to a deck and enqueue `vocabulary.card.created` in the
 * SAME transaction (transactional outbox). The relay publishes it to Kafka.
 */
@Injectable()
export class CreateCardUseCase {
  constructor(
    @Inject(DECK_REPOSITORY) private readonly decks: DeckRepository,
    @Inject(CARD_REPOSITORY) private readonly cards: CardRepository,
  ) {}

  async execute(ownerId: string, deckId: string, dto: CreateCardDto): Promise<CardDto> {
    const deck = await this.decks.findById(deckId);
    if (!deck || !deck.isOwnedBy(ownerId)) {
      throw new NotFoundException(`Deck ${deckId} not found`);
    }

    const card = Card.create(deckId, dto);
    const event = cardCreatedEvent(card, ownerId);
    await this.cards.createWithEvent(card, event);

    return toCardDto(card);
  }
}
