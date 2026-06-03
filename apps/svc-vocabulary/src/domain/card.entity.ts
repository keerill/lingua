import { randomUUID } from 'node:crypto';
import { CreateCardDto } from '@lingua/contracts';

export class Card {
  constructor(
    public readonly id: string,
    public readonly deckId: string,
    public readonly term: string,
    public readonly translation: string,
    public readonly example: string | null,
    public readonly createdAt: Date,
  ) {}

  static create(
    deckId: string,
    dto: CreateCardDto,
    now: Date = new Date(),
  ): Card {
    return new Card(
      randomUUID(),
      deckId,
      dto.term,
      dto.translation,
      dto.example ?? null,
      now,
    );
  }
}
