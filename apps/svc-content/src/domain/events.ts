import { randomUUID } from 'node:crypto';
import { ScenarioUpdatedEvent, Topics } from '@lingua/contracts';
import { Scenario } from './scenario.entity';

export function scenarioUpsertedEvent(
  scenario: Scenario,
): ScenarioUpdatedEvent {
  return {
    eventId: randomUUID(),
    type: Topics.ContentScenarioUpdated,
    occurredAt: new Date().toISOString(),
    payload: {
      scenarioId: scenario.id,
      slug: scenario.slug,
      change: 'upserted',
    },
  };
}

export function scenarioDeletedEvent(scenario: Scenario): ScenarioUpdatedEvent {
  return {
    eventId: randomUUID(),
    type: Topics.ContentScenarioUpdated,
    occurredAt: new Date().toISOString(),
    payload: {
      scenarioId: scenario.id,
      slug: scenario.slug,
      change: 'deleted',
    },
  };
}
