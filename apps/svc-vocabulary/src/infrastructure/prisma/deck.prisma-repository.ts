import { Injectable } from '@nestjs/common';
import { Deck, DeckSource } from '../../domain/deck.entity';
import { DeckRepository } from '../../domain/ports/deck.repository';
import { PrismaService } from './prisma.service';

type DeckRow = {
  id: string;
  ownerId: string;
  title: string;
  langFrom: string;
  langTo: string;
  source: string | null;
  createdAt: Date;
};

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

  async findOrCreateSpeakingDeck(ownerId: string): Promise<Deck> {
    const row = await this.prisma.deck.upsert({
      where: { ownerId_source: { ownerId, source: 'speaking' } },
      create: {
        ownerId,
        source: 'speaking',
        title: 'Speaking practice',
        langFrom: 'en',
        langTo: 'ru',
      },
      update: {},
    });
    return this.toDomain(row);
  }

  private toDomain(r: DeckRow): Deck {
    return new Deck(
      r.id,
      r.ownerId,
      r.title,
      r.langFrom,
      r.langTo,
      r.createdAt,
      (r.source as DeckSource | null) ?? null,
    );
  }
}
