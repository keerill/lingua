import { ReviewGrade } from '@lingua/contracts';
import { ScheduleSnapshot } from './schedule-snapshot';
import { FsrsService } from './fsrs.domain-service';

export class Schedule {
  private constructor(
    public readonly userId: string,
    public readonly cardId: string,
    public readonly snapshot: ScheduleSnapshot,
  ) {}

  static fromSnapshot(
    userId: string,
    cardId: string,
    snapshot: ScheduleSnapshot,
  ): Schedule {
    return new Schedule(userId, cardId, snapshot);
  }

  static createInitial(
    userId: string,
    cardId: string,
    fsrs: FsrsService,
    now: Date = new Date(),
  ): Schedule {
    return new Schedule(userId, cardId, fsrs.initial(now));
  }

  applyReview(
    grade: ReviewGrade,
    fsrs: FsrsService,
    now: Date = new Date(),
  ): Schedule {
    const next = fsrs.review(this.snapshot, grade, now);
    return new Schedule(this.userId, this.cardId, next);
  }
}
