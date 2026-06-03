import { randomUUID } from 'node:crypto';
import { CreateDeckDto } from '@lingua/contracts';

export type DeckSource = 'speaking';

export class Deck {
  constructor(
    public readonly id: string,
    public readonly ownerId: string,
    public readonly title: string,
    public readonly langFrom: string,
    public readonly langTo: string,
    public readonly createdAt: Date,

    public readonly source: DeckSource | null = null,
  ) {}

  static create(
    ownerId: string,
    dto: CreateDeckDto,
    now: Date = new Date(),
  ): Deck {
    return new Deck(
      randomUUID(),
      ownerId,
      dto.title,
      dto.langFrom,
      dto.langTo,
      now,
    );
  }

  isOwnedBy(ownerId: string): boolean {
    return this.ownerId === ownerId;
  }
}
