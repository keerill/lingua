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
  CreateDeckTemplateDto,
  DeckTemplate as DeckTemplateDto,
  UpdateDeckTemplateDto,
} from '@lingua/contracts';
import {
  CreateDeckTemplateUseCase,
  DeleteDeckTemplateUseCase,
  ListDeckTemplatesUseCase,
  UpdateDeckTemplateUseCase,
} from '../../application/deck-template.usecases';

@Controller('internal/deck-templates')
export class DeckTemplatesController {
  constructor(
    private readonly createTemplate: CreateDeckTemplateUseCase,
    private readonly updateTemplate: UpdateDeckTemplateUseCase,
    private readonly deleteTemplate: DeleteDeckTemplateUseCase,
    private readonly listTemplates: ListDeckTemplatesUseCase,
  ) {}

  @Get()
  list(): Promise<DeckTemplateDto[]> {
    return this.listTemplates.execute();
  }

  @Post()
  create(@Body() dto: CreateDeckTemplateDto): Promise<DeckTemplateDto> {
    return this.createTemplate.execute(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDeckTemplateDto,
  ): Promise<DeckTemplateDto> {
    return this.updateTemplate.execute(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.deleteTemplate.execute(id);
  }
}
