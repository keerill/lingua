import { Inject, Injectable } from '@nestjs/common';
import { FsrsService } from '../domain/fsrs.domain-service';
import {
  SCHEDULE_REPOSITORY,
  ScheduleRepository,
} from '../domain/ports/schedule.repository';
import { DueScheduleRow } from './dto';

/** Use case: list the cards currently due for a user (read side). */
@Injectable()
export class GetReviewQueueUseCase {
  constructor(
    @Inject(SCHEDULE_REPOSITORY) private readonly schedules: ScheduleRepository,
    private readonly fsrs: FsrsService,
  ) {}

  async execute(userId: string, limit: number): Promise<DueScheduleRow[]> {
    const due = await this.schedules.findDue(userId, limit);
    return due.map((s) => ({
      cardId: s.cardId,
      due: s.snapshot.due.toISOString(),
      state: this.fsrs.stateName(s.snapshot.state),
      reps: s.snapshot.reps,
      lapses: s.snapshot.lapses,
    }));
  }
}
