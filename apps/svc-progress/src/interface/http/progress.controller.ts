import { Controller, Get } from '@nestjs/common';
import { ProgressDashboard, ProgressOverview } from '@lingua/contracts';
import { GetProgressUseCase } from '../../application/get-progress.usecase';
import { UserId } from './user-id.decorator';

@Controller('internal/progress')
export class ProgressController {
  constructor(private readonly getProgress: GetProgressUseCase) {}

  @Get('overview')
  overview(@UserId() userId: string): Promise<ProgressOverview> {
    return this.getProgress.overview(userId);
  }

  @Get('dashboard')
  dashboard(@UserId() userId: string): Promise<ProgressDashboard> {
    return this.getProgress.dashboard(userId);
  }
}
