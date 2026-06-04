import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ProgressDashboard, ProgressOverview } from '@lingua/contracts';
import { CurrentUser, JwtAuthGuard } from '@lingua/auth';
import {
  PROGRESS_PORT,
  ProgressPort,
} from '../../application/ports/progress.port';

@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(@Inject(PROGRESS_PORT) private readonly progress: ProgressPort) {}

  @Get('overview')
  overview(@CurrentUser('sub') sub: string): Promise<ProgressOverview> {
    return this.progress.getOverview(sub);
  }

  @Get('dashboard')
  dashboard(@CurrentUser('sub') sub: string): Promise<ProgressDashboard> {
    return this.progress.getDashboard(sub);
  }
}
