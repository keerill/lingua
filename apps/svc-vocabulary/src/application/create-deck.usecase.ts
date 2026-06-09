import { Inject, Injectable } from '@nestjs/common';
import { CreateDeckDto, Deck as DeckDto } from '@lingua/contracts';
import { Deck } from '../domain/deck.entity';
import { DECK_REPOSITORY, DeckRepository } from '../domain/ports/deck.repository';
import { toDeckDto } from './mappers';

/** Use case: create a new deck for an owner. */
@Injectable()
export class CreateDeckUseCase {
  constructor(@Inject(DECK_REPOSITORY) private readonly decks: DeckRepository) {}

  async execute(ownerId: string, dto: CreateDeckDto): Promise<DeckDto> {
    const deck = Deck.create(ownerId, dto);
    await this.decks.create(deck);
    return toDeckDto(deck);
  }
}
