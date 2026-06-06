import { Inject, Injectable } from '@nestjs/common';
import { ProgressDashboard, ProgressOverview } from '@lingua/contracts';
import { buildOverview } from '../domain/progress.calculations';
import { CLOCK, Clock } from '../domain/ports/clock';
import { PROGRESS_STORE, ProgressStore } from '../domain/ports/progress.store';

@Injectable()
export class GetProgressUseCase {
  constructor(
    @Inject(PROGRESS_STORE) private readonly store: ProgressStore,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async overview(userId: string): Promise<ProgressOverview> {
    const [cardStates, dailies] = await Promise.all([
      this.store.listCardStates(userId),
      this.store.listDailyActivity(userId),
    ]);
    return buildOverview(userId, cardStates, dailies, this.clock.now());
  }

  async dashboard(userId: string): Promise<ProgressDashboard> {
    const [cardStates, dailies, pronunciation] = await Promise.all([
      this.store.listCardStates(userId),
      this.store.listDailyActivity(userId),
      this.store.listPronunciationDaily(userId),
    ]);

    const sortedDailies = dailies
      .slice()
      .sort((a, b) => a.day.localeCompare(b.day));
    const overview = buildOverview(
      userId,
      cardStates,
      dailies,
      this.clock.now(),
    );

    return {
      overview,
      reviewsByDay: sortedDailies.map((d) => ({
        day: d.day,
        count: d.reviews,
      })),
      learnedByDay: sortedDailies.map((d) => ({
        day: d.day,
        count: d.learned,
      })),
      pronunciationTrend: pronunciation
        .slice()
        .sort((a, b) => a.day.localeCompare(b.day))
        .map((p) => ({ day: p.day, mistakes: p.mistakes })),
    };
  }
}
