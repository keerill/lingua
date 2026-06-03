import { Injectable } from '@nestjs/common';
import { CardCreatedEvent, CardsFlaggedEvent } from '@lingua/contracts';
import { traceHeaders } from '@lingua/observability';
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

@Injectable()
export class PrismaCardRepository implements CardRepository {
  constructor(private readonly prisma: PrismaService) {}

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
        data: {
          topic: event.type,
          key: card.id,
          payload: event as unknown as object,
          headers: traceHeaders(),
        },
      });
    });
  }

  async findByIds(ownerId: string, ids: string[]): Promise<Card[]> {
    const rows = await this.prisma.card.findMany({
      where: { id: { in: ids }, deck: { ownerId } },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByDeckAndTerms(deckId: string, terms: string[]): Promise<Card[]> {
    if (terms.length === 0) return [];
    const rows = await this.prisma.card.findMany({
      where: { deckId, term: { in: terms } },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async ingestMistakeCards(
    newCards: Card[],
    cardCreatedEvents: CardCreatedEvent[],
    flaggedEvent: CardsFlaggedEvent,
  ): Promise<void> {
    const headers = traceHeaders();
    await this.prisma.$transaction(async (tx) => {
      if (newCards.length > 0) {
        await tx.card.createMany({
          data: newCards.map((c) => ({
            id: c.id,
            deckId: c.deckId,
            term: c.term,
            translation: c.translation,
            example: c.example,
            createdAt: c.createdAt,
          })),
        });
        await tx.outbox.createMany({
          data: cardCreatedEvents.map((e) => ({
            topic: e.type,
            key: e.payload.cardId,
            payload: e as unknown as object,
            headers,
          })),
        });
      }
      await tx.outbox.create({
        data: {
          topic: flaggedEvent.type,
          key: flaggedEvent.payload.userId,
          payload: flaggedEvent as unknown as object,
          headers,
        },
      });
    });
  }

  private toDomain(r: CardRow): Card {
    return new Card(
      r.id,
      r.deckId,
      r.term,
      r.translation,
      r.example,
      r.createdAt,
    );
  }
}
