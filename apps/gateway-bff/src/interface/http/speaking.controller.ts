import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@lingua/auth';
import {
  DIALOG_PORT,
  DialogPort,
  ScenarioInfo,
} from '../../application/ports/dialog.port';

@Controller('speaking')
@UseGuards(JwtAuthGuard)
export class SpeakingController {
  constructor(@Inject(DIALOG_PORT) private readonly dialog: DialogPort) {}

  @Get('scenarios')
  scenarios(): Promise<ScenarioInfo[]> {
    return this.dialog.listScenarios();
  }
}
