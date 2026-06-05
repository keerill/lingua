import { Scenario, ScenarioSummary } from '@lingua/contracts';
import { LlmProvider, LlmTurn } from '../domain/ports/llm.provider';
import { MistakeDetector } from '../domain/ports/mistake.detector';
import {
  AppendTurnInput,
  DialogSessionRepository,
  DialogTurnHistory,
} from '../domain/ports/dialog-session.repository';
import { ScenarioProvider } from '../domain/ports/scenario.provider';
import { Mistake } from '../domain/mistake';
import { RunTurnUseCase } from './run-turn.usecase';

class FakeLlm implements LlmProvider {
  async *streamReply(_turn: LlmTurn): AsyncIterable<string> {
    yield 'Hello ';
    yield 'there';
  }
}

class StubDetector implements MistakeDetector {
  constructor(private readonly mistakes: Mistake[]) {}
  detect(): Mistake[] {
    return this.mistakes;
  }
}

class FakeScenarioProvider implements ScenarioProvider {
  private readonly known = new Set(['interview', 'small_talk']);
  async list(): Promise<ScenarioSummary[]> {
    return [];
  }
  async get(id: string): Promise<Scenario | null> {
    if (!this.known.has(id)) return null;
    const now = new Date().toISOString();
    return {
      id,
      slug: id,
      title: id,
      description: id,
      level: 'A1',
      systemPrompt: `prompt for ${id}`,
      published: true,
      createdAt: now,
      updatedAt: now,
    };
  }
}

class MemorySessions implements DialogSessionRepository {
  turns: { userText: string; aiText: string }[] = [];
  events: AppendTurnInput['event'][] = [];
  async history(): Promise<DialogTurnHistory[]> {
    return [];
  }
  async appendTurn(input: AppendTurnInput): Promise<void> {
    this.turns.push({ userText: input.userText, aiText: input.aiText });
    if (input.event) this.events.push(input.event);
  }
}

async function drain(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const t of gen) out.push(t);
  return out;
}

describe('RunTurnUseCase', () => {
  it('streams the reply and emits an event when mistakes are present', async () => {
    const repo = new MemorySessions();
    const uc = new RunTurnUseCase(
      new FakeLlm(),
      new StubDetector([
        { term: 'went', kind: 'grammar', context: 'yesterday I go' },
      ]),
      repo,
      new FakeScenarioProvider(),
    );

    const tokens = await drain(
      uc.stream({
        sessionId: 's1',
        userId: 'u1',
        scenarioId: 'interview',
        userText: 'yesterday I go',
      }),
    );

    expect(tokens.join('')).toBe('Hello there');
    expect(repo.turns).toEqual([
      { userText: 'yesterday I go', aiText: 'Hello there' },
    ]);
    expect(repo.events).toHaveLength(1);
    expect(repo.events[0]!.type).toBe('speaking.mistake.detected');
    expect(repo.events[0]!.payload.userId).toBe('u1');
    expect(repo.events[0]!.payload.mistakes[0].term).toBe('went');
  });

  it('emits no event when there are no mistakes', async () => {
    const repo = new MemorySessions();
    const uc = new RunTurnUseCase(
      new FakeLlm(),
      new StubDetector([]),
      repo,
      new FakeScenarioProvider(),
    );
    await drain(
      uc.stream({
        sessionId: 's1',
        userId: 'u1',
        scenarioId: 'small_talk',
        userText: 'all good',
      }),
    );
    expect(repo.turns).toHaveLength(1);
    expect(repo.events).toHaveLength(0);
  });

  it('throws on an unknown scenario', async () => {
    const repo = new MemorySessions();
    const uc = new RunTurnUseCase(
      new FakeLlm(),
      new StubDetector([]),
      repo,
      new FakeScenarioProvider(),
    );
    await expect(
      drain(
        uc.stream({
          sessionId: 's1',
          userId: 'u1',
          scenarioId: 'nope',
          userText: 'hi',
        }),
      ),
    ).rejects.toThrow(/unknown scenario/);
  });
});
