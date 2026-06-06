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
  CreateScenarioDto,
  Scenario as ScenarioDto,
  UpdateScenarioDto,
} from '@lingua/contracts';
import {
  CreateScenarioUseCase,
  DeleteScenarioUseCase,
  GetScenarioUseCase,
  ListScenariosUseCase,
  UpdateScenarioUseCase,
} from '../../application/scenario.usecases';

@Controller('internal/scenarios')
export class ScenariosController {
  constructor(
    private readonly createScenario: CreateScenarioUseCase,
    private readonly updateScenario: UpdateScenarioUseCase,
    private readonly deleteScenario: DeleteScenarioUseCase,
    private readonly listScenarios: ListScenariosUseCase,
    private readonly getScenario: GetScenarioUseCase,
  ) {}

  @Get()
  list(): Promise<ScenarioDto[]> {
    return this.listScenarios.execute();
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<ScenarioDto> {
    return this.getScenario.byId(id);
  }

  @Post()
  create(@Body() dto: CreateScenarioDto): Promise<ScenarioDto> {
    return this.createScenario.execute(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateScenarioDto,
  ): Promise<ScenarioDto> {
    return this.updateScenario.execute(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.deleteScenario.execute(id);
  }
}
