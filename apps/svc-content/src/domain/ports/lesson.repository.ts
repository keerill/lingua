import { Lesson } from '../lesson.entity';

export const LESSON_REPOSITORY = Symbol('LessonRepository');

export interface ListLessonOptions {
  publishedOnly?: boolean;
}

export interface LessonRepository {
  create(lesson: Lesson): Promise<void>;
  update(lesson: Lesson): Promise<void>;
  remove(id: string): Promise<void>;
  findById(id: string): Promise<Lesson | null>;
  findBySlug(slug: string): Promise<Lesson | null>;
  list(options?: ListLessonOptions): Promise<Lesson[]>;
}
