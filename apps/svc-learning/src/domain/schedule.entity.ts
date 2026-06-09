import { ReviewGrade } from '@lingua/contracts';
import { ScheduleSnapshot } from './schedule-snapshot';
import { FsrsService } from './fsrs.domain-service';

/**
 * Aggregate root: a card's review schedule for a given user. Identity is
 * (userId, cardId). Behaviour (initial creation, review recomputation) is
 * expressed here and delegates the spaced-repetition math to {@link FsrsService}.
 */
export class Schedule {
  private constructor(
    public readonly userId: string,
    public readonly cardId: string,
    public readonly snapshot: ScheduleSnapshot,
  ) {}

  /** Rehydrate from persistence. */
  static fromSnapshot(userId: string, cardId: string, snapshot: ScheduleSnapshot): Schedule {
    return new Schedule(userId, cardId, snapshot);
  }

  /** Create the initial (New) schedule for a freshly added card. */
  static createInitial(
    userId: string,
    cardId: string,
    fsrs: FsrsService,
    now: Date = new Date(),
  ): Schedule {
    return new Schedule(userId, cardId, fsrs.initial(now));
  }

  /** Produce the next schedule after a review — a new immutable Schedule. */
  applyReview(grade: ReviewGrade, fsrs: FsrsService, now: Date = new Date()): Schedule {
    const next = fsrs.review(this.snapshot, grade, now);
    return new Schedule(this.userId, this.cardId, next);
  }
}
