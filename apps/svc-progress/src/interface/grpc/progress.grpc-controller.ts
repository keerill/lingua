import { Controller } from '@nestjs/common';
import { progressV1 } from '@lingua/contracts/proto';
import { ProgressOverview } from '@lingua/contracts';
import { GetProgressUseCase } from '../../application/get-progress.usecase';

function toProtoOverview(o: ProgressOverview): progressV1.ProgressOverview {
  return {
    userId: o.userId,
    currentStreak: o.currentStreak,
    longestStreak: o.longestStreak,
    dueCount: o.dueCount,
    learnedWords: o.learnedWords,
    totalReviews: o.totalReviews,
    lastActiveDay: o.lastActiveDay ?? undefined,
  };
}

@Controller()
@progressV1.ProgressServiceControllerMethods()
export class ProgressGrpcController
  implements progressV1.ProgressServiceController
{
  constructor(private readonly getProgress: GetProgressUseCase) {}

  async getOverview(
    request: progressV1.GetOverviewRequest,
  ): Promise<progressV1.ProgressOverview> {
    return toProtoOverview(await this.getProgress.overview(request.userId));
  }

  async getDashboard(
    request: progressV1.GetDashboardRequest,
  ): Promise<progressV1.ProgressDashboard> {
    const d = await this.getProgress.dashboard(request.userId);
    return {
      overview: toProtoOverview(d.overview),
      reviewsByDay: d.reviewsByDay,
      learnedByDay: d.learnedByDay,
      pronunciationTrend: d.pronunciationTrend,
    };
  }
}
