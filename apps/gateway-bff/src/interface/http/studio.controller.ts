import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { JwtAuthGuard, Roles, RolesGuard } from '@lingua/auth';
import {
  CONTENT_PORT,
  ContentPort,
} from '../../application/ports/content.port';

@Controller('studio')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class StudioController {
  constructor(@Inject(CONTENT_PORT) private readonly content: ContentPort) {}

  @Get('scenarios')
  listScenarios(): Promise<Scenario[]> {
    return this.content.listScenarios();
  }
  @Get('scenarios/:id')
  getScenario(@Param('id') id: string): Promise<Scenario> {
    return this.content.getScenario(id);
  }
  @Post('scenarios')
  createScenario(@Body() dto: CreateScenarioDto): Promise<Scenario> {
    return this.content.createScenario(dto);
  }
  @Patch('scenarios/:id')
  updateScenario(
    @Param('id') id: string,
    @Body() dto: UpdateScenarioDto,
  ): Promise<Scenario> {
    return this.content.updateScenario(id, dto);
  }
  @Delete('scenarios/:id')
  @HttpCode(204)
  deleteScenario(@Param('id') id: string): Promise<void> {
    return this.content.deleteScenario(id);
  }

  @Get('lessons')
  listLessons(): Promise<Lesson[]> {
    return this.content.listLessons();
  }
  @Post('lessons')
  createLesson(@Body() dto: CreateLessonDto): Promise<Lesson> {
    return this.content.createLesson(dto);
  }
  @Patch('lessons/:id')
  updateLesson(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
  ): Promise<Lesson> {
    return this.content.updateLesson(id, dto);
  }
  @Delete('lessons/:id')
  @HttpCode(204)
  deleteLesson(@Param('id') id: string): Promise<void> {
    return this.content.deleteLesson(id);
  }

  @Get('deck-templates')
  listDeckTemplates(): Promise<DeckTemplate[]> {
    return this.content.listDeckTemplates();
  }
  @Post('deck-templates')
  createDeckTemplate(
    @Body() dto: CreateDeckTemplateDto,
  ): Promise<DeckTemplate> {
    return this.content.createDeckTemplate(dto);
  }
  @Patch('deck-templates/:id')
  updateDeckTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateDeckTemplateDto,
  ): Promise<DeckTemplate> {
    return this.content.updateDeckTemplate(id, dto);
  }
  @Delete('deck-templates/:id')
  @HttpCode(204)
  deleteDeckTemplate(@Param('id') id: string): Promise<void> {
    return this.content.deleteDeckTemplate(id);
  }
}
