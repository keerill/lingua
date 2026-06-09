import { Injectable } from '@nestjs/common';
import { Deck } from '../../domain/deck.entity';
import { DeckRepository } from '../../domain/ports/deck.repository';
import { PrismaService } from './prisma.service';

type DeckRow = {
  id: string;
  ownerId: string;
  title: string;
  langFrom: string;
  langTo: string;
  createdAt: Date;
};

/** Prisma adapter for {@link DeckRepository}. */
@Injectable()
export class PrismaDeckRepository implements DeckRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(deck: Deck): Promise<void> {
    await this.prisma.deck.create({
      data: {
        id: deck.id,
        ownerId: deck.ownerId,
        title: deck.title,
        langFrom: deck.langFrom,
        langTo: deck.langTo,
        createdAt: deck.createdAt,
      },
    });
  }

  async findById(id: string): Promise<Deck | null> {
    const row = await this.prisma.deck.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByOwner(ownerId: string): Promise<Deck[]> {
    const rows = await this.prisma.deck.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(r: DeckRow): Deck {
    return new Deck(r.id, r.ownerId, r.title, r.langFrom, r.langTo, r.createdAt);
  }
}
