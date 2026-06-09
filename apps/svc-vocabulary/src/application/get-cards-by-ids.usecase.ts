import { Inject, Injectable } from '@nestjs/common';
import { Card as CardDto } from '@lingua/contracts';
import { CARD_REPOSITORY, CardRepository } from '../domain/ports/card.repository';
import { toCardDto } from './mappers';

/** Use case: fetch the owner's cards by id (BFF review-queue enrichment). */
@Injectable()
export class GetCardsByIdsUseCase {
  constructor(@Inject(CARD_REPOSITORY) private readonly cards: CardRepository) {}

  async execute(ownerId: string, ids: string[]): Promise<CardDto[]> {
    if (ids.length === 0) return [];
    const cards = await this.cards.findByIds(ownerId, ids);
    return cards.map(toCardDto);
  }
}
