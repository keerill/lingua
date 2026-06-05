import { Scenario, ScenarioSummary } from '@lingua/contracts';

export const SCENARIO_PROVIDER = Symbol('ScenarioProvider');

export interface ScenarioProvider {
  list(): Promise<ScenarioSummary[]>;

  get(id: string): Promise<Scenario | null>;
}
