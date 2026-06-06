import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateLessonDto,
  Lesson as LessonDto,
  LessonSummary,
  UpdateLessonDto,
} from '@lingua/contracts';
import { Lesson } from '../domain/lesson.entity';
import {
  LESSON_REPOSITORY,
  LessonRepository,
} from '../domain/ports/lesson.repository';
import { toLessonDto, toLessonSummary } from './mappers';

@Injectable()
export class CreateLessonUseCase {
  constructor(
    @Inject(LESSON_REPOSITORY) private readonly lessons: LessonRepository,
  ) {}

  async execute(dto: CreateLessonDto): Promise<LessonDto> {
    const lesson = Lesson.create(dto);
    await this.lessons.create(lesson);
    return toLessonDto(lesson);
  }
}

@Injectable()
export class UpdateLessonUseCase {
  constructor(
    @Inject(LESSON_REPOSITORY) private readonly lessons: LessonRepository,
  ) {}

  async execute(id: string, dto: UpdateLessonDto): Promise<LessonDto> {
    const existing = await this.lessons.findById(id);
    if (!existing) throw new NotFoundException(`Lesson ${id} not found`);
    const updated = existing.withUpdate(dto);
    await this.lessons.update(updated);
    return toLessonDto(updated);
  }
}

@Injectable()
export class DeleteLessonUseCase {
  constructor(
    @Inject(LESSON_REPOSITORY) private readonly lessons: LessonRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.lessons.findById(id);
    if (!existing) throw new NotFoundException(`Lesson ${id} not found`);
    await this.lessons.remove(id);
  }
}

@Injectable()
export class ListLessonsUseCase {
  constructor(
    @Inject(LESSON_REPOSITORY) private readonly lessons: LessonRepository,
  ) {}

  async execute(): Promise<LessonDto[]> {
    const lessons = await this.lessons.list();
    return lessons.map(toLessonDto);
  }

  async published(): Promise<LessonSummary[]> {
    const lessons = await this.lessons.list({ publishedOnly: true });
    return lessons.map(toLessonSummary);
  }
}

@Injectable()
export class GetLessonUseCase {
  constructor(
    @Inject(LESSON_REPOSITORY) private readonly lessons: LessonRepository,
  ) {}

  async byId(id: string): Promise<LessonDto> {
    const lesson = await this.lessons.findById(id);
    if (!lesson) throw new NotFoundException(`Lesson ${id} not found`);
    return toLessonDto(lesson);
  }

  async publishedBySlug(slug: string): Promise<LessonDto> {
    const lesson = await this.lessons.findBySlug(slug);
    if (!lesson || !lesson.published)
      throw new NotFoundException(`Lesson ${slug} not found`);
    return toLessonDto(lesson);
  }
}
