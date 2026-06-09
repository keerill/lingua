import { Inject, Injectable } from '@nestjs/common';
import { Deck as DeckDto } from '@lingua/contracts';
import { DECK_REPOSITORY, DeckRepository } from '../domain/ports/deck.repository';
import { toDeckDto } from './mappers';

/** Use case: list an owner's decks (newest first). */
@Injectable()
export class ListDecksUseCase {
  constructor(@Inject(DECK_REPOSITORY) private readonly decks: DeckRepository) {}

  async execute(ownerId: string): Promise<DeckDto[]> {
    const decks = await this.decks.findByOwner(ownerId);
    return decks.map(toDeckDto);
  }
}
