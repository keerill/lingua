import {
  CreateDeckTemplateDto,
  CreateLessonDto,
  CreateScenarioDto,
  DeckTemplate,
  Lesson,
  Scenario,
  UpdateDeckTemplateDto,
  UpdateLessonDto,
  UpdateScenarioDto,
} from '@lingua/contracts';

export const CONTENT_PORT = Symbol('ContentPort');

export interface ContentPort {
  listScenarios(): Promise<Scenario[]>;
  getScenario(id: string): Promise<Scenario>;
  createScenario(dto: CreateScenarioDto): Promise<Scenario>;
  updateScenario(id: string, dto: UpdateScenarioDto): Promise<Scenario>;
  deleteScenario(id: string): Promise<void>;
  listLessons(): Promise<Lesson[]>;
  createLesson(dto: CreateLessonDto): Promise<Lesson>;
  updateLesson(id: string, dto: UpdateLessonDto): Promise<Lesson>;
  deleteLesson(id: string): Promise<void>;
  listDeckTemplates(): Promise<DeckTemplate[]>;
  createDeckTemplate(dto: CreateDeckTemplateDto): Promise<DeckTemplate>;
  updateDeckTemplate(
    id: string,
    dto: UpdateDeckTemplateDto,
  ): Promise<DeckTemplate>;
  deleteDeckTemplate(id: string): Promise<void>;
}
