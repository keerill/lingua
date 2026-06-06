import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CreateLessonDto,
  Lesson as LessonDto,
  UpdateLessonDto,
} from '@lingua/contracts';
import {
  CreateLessonUseCase,
  DeleteLessonUseCase,
  GetLessonUseCase,
  ListLessonsUseCase,
  UpdateLessonUseCase,
} from '../../application/lesson.usecases';

@Controller('internal/lessons')
export class LessonsController {
  constructor(
    private readonly createLesson: CreateLessonUseCase,
    private readonly updateLesson: UpdateLessonUseCase,
    private readonly deleteLesson: DeleteLessonUseCase,
    private readonly listLessons: ListLessonsUseCase,
    private readonly getLesson: GetLessonUseCase,
  ) {}

  @Get()
  list(): Promise<LessonDto[]> {
    return this.listLessons.execute();
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<LessonDto> {
    return this.getLesson.byId(id);
  }

  @Post()
  create(@Body() dto: CreateLessonDto): Promise<LessonDto> {
    return this.createLesson.execute(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
  ): Promise<LessonDto> {
    return this.updateLesson.execute(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.deleteLesson.execute(id);
  }
}
