import { Body, Controller, Get, Inject, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ScenarioSummary } from '@lingua/contracts';
import { RunTurnUseCase } from '../../application/run-turn.usecase';
import { ListScenariosUseCase } from '../../application/list-scenarios.usecase';
import {
  SCENARIO_PROVIDER,
  ScenarioProvider,
} from '../../domain/ports/scenario.provider';

interface TurnRequest {
  sessionId: string;
  userId: string;
  scenario: string;
  userText: string;
}

@Controller()
export class DialogController {
  constructor(
    private readonly runTurn: RunTurnUseCase,
    private readonly listScenarios: ListScenariosUseCase,
    @Inject(SCENARIO_PROVIDER)
    private readonly scenarioProvider: ScenarioProvider,
  ) {}

  @Get('scenarios')
  scenarios(): Promise<ScenarioSummary[]> {
    return this.listScenarios.execute();
  }

  @Post('dialog/turn')
  async turn(@Body() body: TurnRequest, @Res() res: Response): Promise<void> {
    const scenario = await this.scenarioProvider.get(body.scenario);
    if (!scenario) {
      res.status(400).json({ message: `unknown scenario: ${body.scenario}` });
      return;
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    try {
      for await (const token of this.runTurn.stream({
        sessionId: body.sessionId,
        userId: body.userId,
        scenarioId: body.scenario,
        userText: body.userText,
      })) {
        res.write(token);
      }
    } finally {
      res.end();
    }
  }
}
