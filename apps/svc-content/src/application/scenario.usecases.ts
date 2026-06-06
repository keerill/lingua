import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateScenarioDto,
  Scenario as ScenarioDto,
  ScenarioSummary,
  UpdateScenarioDto,
} from '@lingua/contracts';
import { Scenario } from '../domain/scenario.entity';
import { scenarioDeletedEvent, scenarioUpsertedEvent } from '../domain/events';
import {
  SCENARIO_REPOSITORY,
  ScenarioRepository,
} from '../domain/ports/scenario.repository';
import { toScenarioDto, toScenarioSummary } from './mappers';

@Injectable()
export class CreateScenarioUseCase {
  constructor(
    @Inject(SCENARIO_REPOSITORY) private readonly scenarios: ScenarioRepository,
  ) {}

  async execute(dto: CreateScenarioDto): Promise<ScenarioDto> {
    const scenario = Scenario.create(dto);
    await this.scenarios.create(scenario, scenarioUpsertedEvent(scenario));
    return toScenarioDto(scenario);
  }
}

@Injectable()
export class UpdateScenarioUseCase {
  constructor(
    @Inject(SCENARIO_REPOSITORY) private readonly scenarios: ScenarioRepository,
  ) {}

  async execute(id: string, dto: UpdateScenarioDto): Promise<ScenarioDto> {
    const existing = await this.scenarios.findById(id);
    if (!existing) throw new NotFoundException(`Scenario ${id} not found`);
    const updated = existing.withUpdate(dto);
    await this.scenarios.update(updated, scenarioUpsertedEvent(updated));
    return toScenarioDto(updated);
  }
}

@Injectable()
export class DeleteScenarioUseCase {
  constructor(
    @Inject(SCENARIO_REPOSITORY) private readonly scenarios: ScenarioRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.scenarios.findById(id);
    if (!existing) throw new NotFoundException(`Scenario ${id} not found`);
    await this.scenarios.remove(existing, scenarioDeletedEvent(existing));
  }
}

@Injectable()
export class ListScenariosUseCase {
  constructor(
    @Inject(SCENARIO_REPOSITORY) private readonly scenarios: ScenarioRepository,
  ) {}

  async execute(): Promise<ScenarioDto[]> {
    const scenarios = await this.scenarios.list();
    return scenarios.map(toScenarioDto);
  }

  async published(): Promise<ScenarioSummary[]> {
    const scenarios = await this.scenarios.list({ publishedOnly: true });
    return scenarios.map(toScenarioSummary);
  }
}

@Injectable()
export class GetScenarioUseCase {
  constructor(
    @Inject(SCENARIO_REPOSITORY) private readonly scenarios: ScenarioRepository,
  ) {}

  async byId(id: string): Promise<ScenarioDto> {
    const scenario = await this.scenarios.findById(id);
    if (!scenario) throw new NotFoundException(`Scenario ${id} not found`);
    return toScenarioDto(scenario);
  }

  async publishedSummaryBySlug(slug: string): Promise<ScenarioSummary> {
    const scenario = await this.scenarios.findBySlug(slug);
    if (!scenario || !scenario.published) {
      throw new NotFoundException(`Scenario ${slug} not found`);
    }
    return toScenarioSummary(scenario);
  }
}
