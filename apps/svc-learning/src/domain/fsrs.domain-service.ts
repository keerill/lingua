import { Injectable } from '@nestjs/common';
import { createEmptyCard, fsrs, FSRS, type Card as FsrsCard, type Grade } from 'ts-fsrs';
import { ReviewGrade, ScheduleState } from '@lingua/contracts';
import { ScheduleSnapshot } from './schedule-snapshot';

const STATE_NAMES: ScheduleState[] = ['New', 'Learning', 'Review', 'Relearning'];

/**
 * Domain service encapsulating the spaced-repetition algorithm (FSRS) — the
 * core domain logic of Lingua. Pure: no I/O, no persistence, fully unit-testable.
 * Our `ReviewGrade` (1=Again..4=Easy) maps 1:1 onto ts-fsrs `Rating`/`Grade`.
 */
@Injectable()
export class FsrsService {
  private readonly scheduler: FSRS = fsrs();

  /** Initial schedule for a freshly created card (state New, due = now). */
  initial(now: Date = new Date()): ScheduleSnapshot {
    return this.fromCard(createEmptyCard(now));
  }

  /** Recompute a schedule after a review at `now` with the given grade. */
  review(current: ScheduleSnapshot, grade: ReviewGrade, now: Date = new Date()): ScheduleSnapshot {
    const card: FsrsCard = this.toCard(current);
    const { card: next } = this.scheduler.next(card, now, grade as unknown as Grade);
    return this.fromCard(next);
  }

  /** Human-readable state name for the API contract. */
  stateName(state: number): ScheduleState {
    return STATE_NAMES[state] ?? 'New';
  }

  private toCard(s: ScheduleSnapshot): FsrsCard {
    return {
      due: s.due,
      stability: s.stability,
      difficulty: s.difficulty,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: s.learningSteps,
      reps: s.reps,
      lapses: s.lapses,
      state: s.state,
      last_review: s.lastReview ?? undefined,
    };
  }

  private fromCard(c: FsrsCard): ScheduleSnapshot {
    return {
      stability: c.stability,
      difficulty: c.difficulty,
      due: c.due,
      reps: c.reps,
      lapses: c.lapses,
      state: c.state,
      lastReview: c.last_review ?? null,
      learningSteps: c.learning_steps,
    };
  }
}
