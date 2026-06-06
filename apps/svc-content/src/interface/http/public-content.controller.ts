import { Controller, Get, Param } from '@nestjs/common';
import {
  Lesson as LessonDto,
  LessonSummary,
  ScenarioSummary,
} from '@lingua/contracts';
import {
  ListScenariosUseCase,
  GetScenarioUseCase,
} from '../../application/scenario.usecases';
import {
  ListLessonsUseCase,
  GetLessonUseCase,
} from '../../application/lesson.usecases';

@Controller('public')
export class PublicContentController {
  constructor(
    private readonly listScenarios: ListScenariosUseCase,
    private readonly getScenario: GetScenarioUseCase,
    private readonly listLessons: ListLessonsUseCase,
    private readonly getLesson: GetLessonUseCase,
  ) {}

  @Get('scenarios')
  scenarios(): Promise<ScenarioSummary[]> {
    return this.listScenarios.published();
  }

  @Get('scenarios/:slug')
  scenario(@Param('slug') slug: string): Promise<ScenarioSummary> {
    return this.getScenario.publishedSummaryBySlug(slug);
  }

  @Get('lessons')
  lessons(): Promise<LessonSummary[]> {
    return this.listLessons.published();
  }

  @Get('lessons/:slug')
  lesson(@Param('slug') slug: string): Promise<LessonDto> {
    return this.getLesson.publishedBySlug(slug);
  }
}
