export type ContentLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface ScenarioSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: ContentLevel;
}

export interface Scenario extends ScenarioSummary {
  systemPrompt: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScenarioDto {
  slug: string;
  title: string;
  description: string;
  systemPrompt: string;
  level: ContentLevel;
  published?: boolean;
}

export interface UpdateScenarioDto {
  title?: string;
  description?: string;
  systemPrompt?: string;
  level?: ContentLevel;
  published?: boolean;
}

export interface LessonSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  level: ContentLevel;
}

export interface Lesson extends LessonSummary {
  contentMarkdown: string;
  published: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLessonDto {
  slug: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  level: ContentLevel;
  order?: number;
  published?: boolean;
}

export interface UpdateLessonDto {
  title?: string;
  summary?: string;
  contentMarkdown?: string;
  level?: ContentLevel;
  order?: number;
  published?: boolean;
}

export interface DeckTemplateCard {
  term: string;
  translation: string;
  example?: string | null;
}

export interface DeckTemplate {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: ContentLevel;
  cards: DeckTemplateCard[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeckTemplateDto {
  slug: string;
  title: string;
  description: string;
  level: ContentLevel;
  cards: DeckTemplateCard[];
}

export interface UpdateDeckTemplateDto {
  title?: string;
  description?: string;
  level?: ContentLevel;
  cards?: DeckTemplateCard[];
}
