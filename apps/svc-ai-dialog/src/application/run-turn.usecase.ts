import { Inject, Injectable } from '@nestjs/common';
import { SpeakingMistakeDetectedEvent } from '@lingua/contracts';
import { speakingMistakeDetectedEvent } from '../domain/events';
import { LLM_PROVIDER, LlmProvider } from '../domain/ports/llm.provider';
import {
  MISTAKE_DETECTOR,
  MistakeDetector,
} from '../domain/ports/mistake.detector';
import {
  DIALOG_SESSION_REPOSITORY,
  DialogSessionRepository,
} from '../domain/ports/dialog-session.repository';
import {
  SCENARIO_PROVIDER,
  ScenarioProvider,
} from '../domain/ports/scenario.provider';

export interface RunTurnInput {
  sessionId: string;
  userId: string;
  scenarioId: string;
  userText: string;
}

@Injectable()
export class RunTurnUseCase {
  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    @Inject(MISTAKE_DETECTOR) private readonly detector: MistakeDetector,
    @Inject(DIALOG_SESSION_REPOSITORY)
    private readonly sessions: DialogSessionRepository,
    @Inject(SCENARIO_PROVIDER) private readonly scenarios: ScenarioProvider,
  ) {}

  async *stream(input: RunTurnInput): AsyncGenerator<string> {
    const scenario = await this.scenarios.get(input.scenarioId);
    if (!scenario) throw new Error(`unknown scenario: ${input.scenarioId}`);

    const history = await this.sessions.history(input.sessionId);
    const mistakes = this.detector.detect(input.userText);

    const parts: string[] = [];
    for await (const token of this.llm.streamReply({
      systemPrompt: scenario.systemPrompt,
      history,
      userText: input.userText,
    })) {
      parts.push(token);
      yield token;
    }
    const aiText = parts.join('').trim();

    let event: SpeakingMistakeDetectedEvent | null = null;
    if (mistakes.length > 0) {
      event = speakingMistakeDetectedEvent(
        input.userId,
        input.sessionId,
        input.scenarioId,
        mistakes,
      );
    }

    await this.sessions.appendTurn({
      sessionId: input.sessionId,
      userId: input.userId,
      scenario: input.scenarioId,
      userText: input.userText,
      aiText,
      event,
    });
  }
}
