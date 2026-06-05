import { Inject, Injectable } from '@nestjs/common';
import { ScenarioSummary } from '@lingua/contracts';
import {
  SCENARIO_PROVIDER,
  ScenarioProvider,
} from '../domain/ports/scenario.provider';

@Injectable()
export class ListScenariosUseCase {
  constructor(
    @Inject(SCENARIO_PROVIDER) private readonly scenarios: ScenarioProvider,
  ) {}

  execute(): Promise<ScenarioSummary[]> {
    return this.scenarios.list();
  }
}
