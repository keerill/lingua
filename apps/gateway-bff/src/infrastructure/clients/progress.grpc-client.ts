import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ProgressDashboard, ProgressOverview } from '@lingua/contracts';
import { progressV1 } from '@lingua/contracts/proto';
import { ProgressPort } from '../../application/ports/progress.port';
import { PROGRESS_GRPC } from './grpc.tokens';

function toOverview(o: progressV1.ProgressOverview): ProgressOverview {
  return {
    userId: o.userId,
    currentStreak: o.currentStreak,
    longestStreak: o.longestStreak,
    dueCount: o.dueCount,
    learnedWords: o.learnedWords,
    totalReviews: o.totalReviews,
    lastActiveDay: o.lastActiveDay ?? null,
  };
}

@Injectable()
export class ProgressGrpcClient implements ProgressPort, OnModuleInit {
  private svc!: progressV1.ProgressServiceClient;

  constructor(@Inject(PROGRESS_GRPC) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.svc = this.client.getService<progressV1.ProgressServiceClient>(
      progressV1.PROGRESS_SERVICE_NAME,
    );
  }

  async getOverview(userId: string): Promise<ProgressOverview> {
    return toOverview(await firstValueFrom(this.svc.getOverview({ userId })));
  }

  async getDashboard(userId: string): Promise<ProgressDashboard> {
    const d = await firstValueFrom(this.svc.getDashboard({ userId }));
    return {
      overview: toOverview(d.overview ?? ({} as progressV1.ProgressOverview)),
      reviewsByDay: d.reviewsByDay ?? [],
      learnedByDay: d.learnedByDay ?? [],
      pronunciationTrend: d.pronunciationTrend ?? [],
    };
  }
}
