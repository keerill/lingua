import { randomUUID } from 'node:crypto';
import {
  ContentLevel,
  CreateLessonDto,
  UpdateLessonDto,
} from '@lingua/contracts';

export class Lesson {
  constructor(
    public readonly id: string,
    public readonly slug: string,
    public readonly title: string,
    public readonly summary: string,
    public readonly contentMarkdown: string,
    public readonly level: ContentLevel,
    public readonly order: number,
    public readonly published: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(dto: CreateLessonDto, now: Date = new Date()): Lesson {
    return new Lesson(
      randomUUID(),
      dto.slug,
      dto.title,
      dto.summary,
      dto.contentMarkdown,
      dto.level,
      dto.order ?? 0,
      dto.published ?? false,
      now,
      now,
    );
  }

  withUpdate(dto: UpdateLessonDto, now: Date = new Date()): Lesson {
    return new Lesson(
      this.id,
      this.slug,
      dto.title ?? this.title,
      dto.summary ?? this.summary,
      dto.contentMarkdown ?? this.contentMarkdown,
      dto.level ?? this.level,
      dto.order ?? this.order,
      dto.published ?? this.published,
      this.createdAt,
      now,
    );
  }
}
