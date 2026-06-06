import { randomUUID } from 'node:crypto';
import {
  ContentLevel,
  CreateDeckTemplateDto,
  DeckTemplateCard,
  UpdateDeckTemplateDto,
} from '@lingua/contracts';

export class DeckTemplate {
  constructor(
    public readonly id: string,
    public readonly slug: string,
    public readonly title: string,
    public readonly description: string,
    public readonly level: ContentLevel,
    public readonly cards: DeckTemplateCard[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(
    dto: CreateDeckTemplateDto,
    now: Date = new Date(),
  ): DeckTemplate {
    return new DeckTemplate(
      randomUUID(),
      dto.slug,
      dto.title,
      dto.description,
      dto.level,
      dto.cards,
      now,
      now,
    );
  }

  withUpdate(dto: UpdateDeckTemplateDto, now: Date = new Date()): DeckTemplate {
    return new DeckTemplate(
      this.id,
      this.slug,
      dto.title ?? this.title,
      dto.description ?? this.description,
      dto.level ?? this.level,
      dto.cards ?? this.cards,
      this.createdAt,
      now,
    );
  }
}
