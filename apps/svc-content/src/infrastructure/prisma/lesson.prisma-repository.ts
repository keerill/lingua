import { Injectable } from '@nestjs/common';
import { ContentLevel } from '@lingua/contracts';
import { Lesson } from '../../domain/lesson.entity';
import {
  LessonRepository,
  ListLessonOptions,
} from '../../domain/ports/lesson.repository';
import { PrismaService } from './prisma.service';

type LessonRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  level: string;
  order: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaLessonRepository implements LessonRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(lesson: Lesson): Promise<void> {
    await this.prisma.lesson.create({ data: this.toData(lesson) });
  }

  async update(lesson: Lesson): Promise<void> {
    await this.prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        title: lesson.title,
        summary: lesson.summary,
        contentMarkdown: lesson.contentMarkdown,
        level: lesson.level,
        order: lesson.order,
        published: lesson.published,
        updatedAt: lesson.updatedAt,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.lesson.delete({ where: { id } });
  }

  async findById(id: string): Promise<Lesson | null> {
    const row = await this.prisma.lesson.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<Lesson | null> {
    const row = await this.prisma.lesson.findUnique({ where: { slug } });
    return row ? this.toDomain(row) : null;
  }

  async list(options?: ListLessonOptions): Promise<Lesson[]> {
    const rows = await this.prisma.lesson.findMany({
      where: options?.publishedOnly ? { published: true } : undefined,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toData(l: Lesson) {
    return {
      id: l.id,
      slug: l.slug,
      title: l.title,
      summary: l.summary,
      contentMarkdown: l.contentMarkdown,
      level: l.level,
      order: l.order,
      published: l.published,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    };
  }

  private toDomain(r: LessonRow): Lesson {
    return new Lesson(
      r.id,
      r.slug,
      r.title,
      r.summary,
      r.contentMarkdown,
      r.level as ContentLevel,
      r.order,
      r.published,
      r.createdAt,
      r.updatedAt,
    );
  }
}
