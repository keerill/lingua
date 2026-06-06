import { ScenarioUpdatedEvent } from '@lingua/contracts';
import { Scenario } from '../domain/scenario.entity';
import {
  ListScenarioOptions,
  ScenarioRepository,
} from '../domain/ports/scenario.repository';
import {
  CreateScenarioUseCase,
  DeleteScenarioUseCase,
  ListScenariosUseCase,
  UpdateScenarioUseCase,
} from './scenario.usecases';

class InMemoryScenarioRepository implements ScenarioRepository {
  scenarios: Scenario[] = [];
  events: ScenarioUpdatedEvent[] = [];

  async create(scenario: Scenario, event: ScenarioUpdatedEvent) {
    this.scenarios.push(scenario);
    this.events.push(event);
  }
  async update(scenario: Scenario, event: ScenarioUpdatedEvent) {
    this.scenarios = this.scenarios.map((s) =>
      s.id === scenario.id ? scenario : s,
    );
    this.events.push(event);
  }
  async remove(scenario: Scenario, event: ScenarioUpdatedEvent) {
    this.scenarios = this.scenarios.filter((s) => s.id !== scenario.id);
    this.events.push(event);
  }
  async findById(id: string) {
    return this.scenarios.find((s) => s.id === id) ?? null;
  }
  async findBySlug(slug: string) {
    return this.scenarios.find((s) => s.slug === slug) ?? null;
  }
  async list(options?: ListScenarioOptions) {
    return options?.publishedOnly
      ? this.scenarios.filter((s) => s.published)
      : this.scenarios;
  }
}

describe('Scenario use cases', () => {
  let repo: InMemoryScenarioRepository;

  beforeEach(() => {
    repo = new InMemoryScenarioRepository();
  });

  it('creates a scenario and emits content.scenario.updated (upserted)', async () => {
    const created = await new CreateScenarioUseCase(repo).execute({
      slug: 'interview',
      title: 'Job interview',
      description: 'Practise a job interview.',
      systemPrompt: 'You are a hiring manager.',
      level: 'B1',
    });

    expect(created.slug).toBe('interview');
    expect(created.published).toBe(false);
    expect(repo.events).toHaveLength(1);
    expect(repo.events[0].type).toBe('content.scenario.updated');
    expect(repo.events[0].payload.change).toBe('upserted');
    expect(repo.events[0].payload.scenarioId).toBe(created.id);
  });

  it('publishing makes a scenario visible in the published catalogue', async () => {
    const create = new CreateScenarioUseCase(repo);
    const update = new UpdateScenarioUseCase(repo);
    const list = new ListScenariosUseCase(repo);

    const draft = await create.execute({
      slug: 'airport',
      title: 'At the airport',
      description: 'Check in and find your gate.',
      systemPrompt: 'You are an airport agent.',
      level: 'A2',
    });

    expect(await list.published()).toHaveLength(0);
    await update.execute(draft.id, { published: true });

    const published = await list.published();
    expect(published).toHaveLength(1);
    expect(published[0].slug).toBe('airport');
    expect(
      published[0] as unknown as Record<string, unknown>,
    ).not.toHaveProperty('systemPrompt');
  });

  it('deletes a scenario and emits a deleted event', async () => {
    const create = new CreateScenarioUseCase(repo);
    const remove = new DeleteScenarioUseCase(repo);

    const s = await create.execute({
      slug: 'restaurant',
      title: 'At a restaurant',
      description: 'Order food.',
      systemPrompt: 'You are a waiter.',
      level: 'A2',
    });

    await remove.execute(s.id);

    expect(repo.scenarios).toHaveLength(0);
    expect(repo.events.at(-1)?.payload.change).toBe('deleted');
  });
});
