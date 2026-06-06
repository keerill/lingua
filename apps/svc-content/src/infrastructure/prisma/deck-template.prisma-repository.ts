import { Injectable } from '@nestjs/common';
import { ContentLevel, DeckTemplateCard } from '@lingua/contracts';
import { DeckTemplate } from '../../domain/deck-template.entity';
import { DeckTemplateRepository } from '../../domain/ports/deck-template.repository';
import { PrismaService } from './prisma.service';

type DeckTemplateRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  cards: unknown;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaDeckTemplateRepository implements DeckTemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(template: DeckTemplate): Promise<void> {
    await this.prisma.deckTemplate.create({ data: this.toData(template) });
  }

  async update(template: DeckTemplate): Promise<void> {
    await this.prisma.deckTemplate.update({
      where: { id: template.id },
      data: {
        title: template.title,
        description: template.description,
        level: template.level,
        cards: template.cards as unknown as object,
        updatedAt: template.updatedAt,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.deckTemplate.delete({ where: { id } });
  }

  async findById(id: string): Promise<DeckTemplate | null> {
    const row = await this.prisma.deckTemplate.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<DeckTemplate | null> {
    const row = await this.prisma.deckTemplate.findUnique({ where: { slug } });
    return row ? this.toDomain(row) : null;
  }

  async list(): Promise<DeckTemplate[]> {
    const rows = await this.prisma.deckTemplate.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toData(t: DeckTemplate) {
    return {
      id: t.id,
      slug: t.slug,
      title: t.title,
      description: t.description,
      level: t.level,
      cards: t.cards as unknown as object,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  private toDomain(r: DeckTemplateRow): DeckTemplate {
    return new DeckTemplate(
      r.id,
      r.slug,
      r.title,
      r.description,
      r.level as ContentLevel,
      (r.cards as DeckTemplateCard[]) ?? [],
      r.createdAt,
      r.updatedAt,
    );
  }
}
