import { ScenarioUpdatedEvent } from '@lingua/contracts';
import { Scenario } from '../scenario.entity';

export const SCENARIO_REPOSITORY = Symbol('ScenarioRepository');

export interface ListScenarioOptions {
  publishedOnly?: boolean;
}

export interface ScenarioRepository {
  create(scenario: Scenario, event: ScenarioUpdatedEvent): Promise<void>;
  update(scenario: Scenario, event: ScenarioUpdatedEvent): Promise<void>;
  remove(scenario: Scenario, event: ScenarioUpdatedEvent): Promise<void>;
  findById(id: string): Promise<Scenario | null>;
  findBySlug(slug: string): Promise<Scenario | null>;
  list(options?: ListScenarioOptions): Promise<Scenario[]>;
}
