import { Injectable } from '@nestjs/common';
import { CardCreatedEvent } from '@lingua/contracts';
import { Card } from '../../domain/card.entity';
import { CardRepository } from '../../domain/ports/card.repository';
import { PrismaService } from './prisma.service';

type CardRow = {
  id: string;
  deckId: string;
  term: string;
  translation: string;
  example: string | null;
  createdAt: Date;
};

/** Prisma adapter for {@link CardRepository}. */
@Injectable()
export class PrismaCardRepository implements CardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Card + outbox event in ONE transaction (transactional outbox). */
  async createWithEvent(card: Card, event: CardCreatedEvent): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.card.create({
        data: {
          id: card.id,
          deckId: card.deckId,
          term: card.term,
          translation: card.translation,
          example: card.example,
          createdAt: card.createdAt,
        },
      });
      await tx.outbox.create({
        data: { topic: event.type, key: card.id, payload: event as unknown as object },
      });
    });
  }

  async findByIds(ownerId: string, ids: string[]): Promise<Card[]> {
    const rows = await this.prisma.card.findMany({
      where: { id: { in: ids }, deck: { ownerId } },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(r: CardRow): Card {
    return new Card(r.id, r.deckId, r.term, r.translation, r.example, r.createdAt);
  }
}
