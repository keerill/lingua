import {
  DeckTemplate as DeckTemplateDto,
  Lesson as LessonDto,
  LessonSummary,
  Scenario as ScenarioDto,
  ScenarioSummary,
} from '@lingua/contracts';
import { Scenario } from '../domain/scenario.entity';
import { Lesson } from '../domain/lesson.entity';
import { DeckTemplate } from '../domain/deck-template.entity';

export const toScenarioDto = (s: Scenario): ScenarioDto => ({
  id: s.id,
  slug: s.slug,
  title: s.title,
  description: s.description,
  systemPrompt: s.systemPrompt,
  level: s.level,
  published: s.published,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

export const toScenarioSummary = (s: Scenario): ScenarioSummary => ({
  id: s.id,
  slug: s.slug,
  title: s.title,
  description: s.description,
  level: s.level,
});

export const toLessonDto = (l: Lesson): LessonDto => ({
  id: l.id,
  slug: l.slug,
  title: l.title,
  summary: l.summary,
  contentMarkdown: l.contentMarkdown,
  level: l.level,
  order: l.order,
  published: l.published,
  createdAt: l.createdAt.toISOString(),
  updatedAt: l.updatedAt.toISOString(),
});

export const toLessonSummary = (l: Lesson): LessonSummary => ({
  id: l.id,
  slug: l.slug,
  title: l.title,
  summary: l.summary,
  level: l.level,
});

export const toDeckTemplateDto = (t: DeckTemplate): DeckTemplateDto => ({
  id: t.id,
  slug: t.slug,
  title: t.title,
  description: t.description,
  level: t.level,
  cards: t.cards,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});
